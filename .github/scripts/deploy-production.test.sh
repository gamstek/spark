#!/usr/bin/env bash

set -eu

script_dir=$(unset CDPATH; cd -- "$(dirname -- "$0")" && pwd)
deploy_script="$script_dir/deploy-production.sh"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_file_contains() {
  file=$1
  expected=$2
  grep -F -- "$expected" "$file" >/dev/null ||
    fail "expected $file to contain: $expected"
}

assert_count() {
  expected=$1
  pattern=$2
  file=$3
  actual=$(grep -F -c -- "$pattern" "$file" || true)
  [ "$actual" -eq "$expected" ] ||
    fail "expected $pattern $expected time(s) in $file, found $actual"
}

make_release() {
  release_dir=$1
  mkdir -p "$release_dir"
  : >"$release_dir/compose.production.yaml"
  : >"$release_dir/.env.release"
  : >"$release_dir/release.json"
}

make_fakes() {
  fake_dir=$1
  mkdir -p "$fake_dir"

  cat >"$fake_dir/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -eu
{
  printf 'docker'
  printf ' %s' "$@"
  printf '\n'
} >>"$TEST_COMMAND_LOG"
FAKE_DOCKER

  cat >"$fake_dir/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -eu
count=0
if [ -f "$TEST_CURL_COUNT" ]; then
  count=$(cat "$TEST_CURL_COUNT")
fi
count=$((count + 1))
printf '%s\n' "$count" >"$TEST_CURL_COUNT"
if [ "$TEST_CURL_MODE" = fail-candidate ] && [ "$count" -le 20 ]; then
  exit 1
fi
FAKE_CURL

  cat >"$fake_dir/sleep" <<'FAKE_SLEEP'
#!/usr/bin/env bash
exit 0
FAKE_SLEEP

  cat >"$fake_dir/stat" <<'FAKE_STAT'
#!/usr/bin/env bash
set -eu
if [ "$1" = '-c' ] && [ "$2" = '%a' ]; then
  printf '600\n'
  exit 0
fi
exec /usr/bin/stat "$@"
FAKE_STAT

  cat >"$fake_dir/mv" <<'FAKE_MV'
#!/usr/bin/env bash
set -eu
if [ "${TEST_MV_MODE:-success}" = fail-current ]; then
  for argument in "$@"; do
    case "$argument" in
      */current)
        exit 1
        ;;
    esac
  done
fi
exec /bin/mv "$@"
FAKE_MV

  chmod +x \
    "$fake_dir/docker" "$fake_dir/curl" "$fake_dir/sleep" "$fake_dir/stat" \
    "$fake_dir/mv"
}

run_activation_failure_case() {
  case_root=$1
  deploy_root="$case_root/deploy"
  fake_dir="$case_root/fakes"
  command_log="$case_root/commands.log"
  curl_count="$case_root/curl-count"

  mkdir -p "$deploy_root/releases"
  printf 'production configuration\n' >"$deploy_root/.env.production"
  chmod 600 "$deploy_root/.env.production"
  make_release "$deploy_root/releases/old"
  make_release "$deploy_root/releases/.incoming-new"
  ln -s 'releases/old' "$deploy_root/current"
  make_fakes "$fake_dir"
  : >"$command_log"

  if PATH="$fake_dir:$PATH" \
    TEST_COMMAND_LOG="$command_log" \
    TEST_CURL_COUNT="$curl_count" \
    TEST_CURL_MODE=success \
    TEST_MV_MODE=fail-current \
    bash "$deploy_script" "$deploy_root" new; then
    fail 'failed current activation returned success'
  fi

  [ "$(readlink "$deploy_root/current")" = 'releases/old' ] ||
    fail 'activation failure changed current away from releases/old'
  assert_count 1 \
    "--env-file $deploy_root/releases/old/.env.release" "$command_log"
}

run_success_case() {
  case_root=$1
  deploy_root="$case_root/deploy"
  fake_dir="$case_root/fakes"
  command_log="$case_root/commands.log"
  curl_count="$case_root/curl-count"

  mkdir -p "$deploy_root/releases"
  printf 'production configuration\n' >"$deploy_root/.env.production"
  chmod 600 "$deploy_root/.env.production"
  make_release "$deploy_root/releases/.incoming-new"
  make_fakes "$fake_dir"
  : >"$command_log"

  PATH="$fake_dir:$PATH" \
    TEST_COMMAND_LOG="$command_log" \
    TEST_CURL_COUNT="$curl_count" \
    TEST_CURL_MODE=success \
    bash "$deploy_script" "$deploy_root" new

  [ -d "$deploy_root/releases/new" ] ||
    fail 'successful release was not moved to releases/new'
  [ ! -e "$deploy_root/releases/.incoming-new" ] ||
    fail 'successful incoming directory still exists'
  [ -L "$deploy_root/current" ] || fail 'current is not a symbolic link'
  [ "$(readlink "$deploy_root/current")" = 'releases/new' ] ||
    fail 'current does not point to releases/new'
  assert_file_contains "$command_log" 'docker compose -p spark '
  assert_file_contains "$command_log" \
    "$deploy_root/releases/new/compose.production.yaml up -d --no-build --remove-orphans"
}

run_rollback_case() {
  case_root=$1
  deploy_root="$case_root/deploy"
  fake_dir="$case_root/fakes"
  command_log="$case_root/commands.log"
  curl_count="$case_root/curl-count"

  mkdir -p "$deploy_root/releases"
  printf 'production configuration\n' >"$deploy_root/.env.production"
  chmod 600 "$deploy_root/.env.production"
  make_release "$deploy_root/releases/old"
  make_release "$deploy_root/releases/.incoming-new"
  ln -s 'releases/old' "$deploy_root/current"
  make_fakes "$fake_dir"
  : >"$command_log"

  if PATH="$fake_dir:$PATH" \
    TEST_COMMAND_LOG="$command_log" \
    TEST_CURL_COUNT="$curl_count" \
    TEST_CURL_MODE=fail-candidate \
    bash "$deploy_script" "$deploy_root" new; then
    fail 'failed candidate readiness returned success'
  fi

  [ -L "$deploy_root/current" ] || fail 'rollback removed current symlink'
  [ "$(readlink "$deploy_root/current")" = 'releases/old' ] ||
    fail 'rollback changed current away from releases/old'
  assert_count 1 \
    "--env-file $deploy_root/releases/old/.env.release" "$command_log"
  assert_file_contains "$command_log" \
    "$deploy_root/releases/old/compose.production.yaml up -d --no-build --remove-orphans"
  assert_count 4 'docker compose -p spark ' "$command_log"
}

test_root=$(mktemp -d)
trap 'rm -rf -- "$test_root"' EXIT HUP INT TERM

run_success_case "$test_root/success"
run_rollback_case "$test_root/rollback"
run_activation_failure_case "$test_root/activation-failure"

printf 'deploy-production tests passed\n'
