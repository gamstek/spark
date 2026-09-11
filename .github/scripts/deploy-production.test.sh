#!/usr/bin/env bash

set -eu

script_dir=$(unset CDPATH; cd -- "$(dirname -- "$0")" && pwd)
deploy_script="$script_dir/deploy-production.sh"
workflow_file="$script_dir/../workflows/deploy-production.yml"

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
if [ -n "${TEST_CURL_LOG:-}" ]; then
  {
    printf 'curl'
    printf ' %s' "$@"
    printf '\n'
  } >>"$TEST_CURL_LOG"
fi
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

extract_workflow_step() {
  step_name=$1
  output_file=$2
  awk -v target="      - name: $step_name" '
    $0 == target { found_step = 1; next }
    found_step && $0 == "        run: |" { in_run = 1; next }
    in_run && /^      - name:/ { exit }
    in_run { sub(/^          /, ""); print }
  ' "$workflow_file" >"$output_file"
  [ -s "$output_file" ] || fail "workflow step was not found: $step_name"
}

run_activation_failure_case() {
  case_root=$1
  deploy_root="$case_root/deploy"
  fake_dir="$case_root/fakes"
  command_log="$case_root/commands.log"
  curl_count="$case_root/curl-count"
  curl_log="$case_root/curl.log"

  mkdir -p "$deploy_root/releases"
  printf 'production configuration\n' >"$deploy_root/.env.production"
  chmod 600 "$deploy_root/.env.production"
  make_release "$deploy_root/releases/old"
  make_release "$deploy_root/releases/.incoming-new"
  ln -s 'releases/old' "$deploy_root/current"
  make_fakes "$fake_dir"
  : >"$command_log"
  : >"$curl_log"

  if PATH="$fake_dir:$PATH" \
    TEST_COMMAND_LOG="$command_log" \
    TEST_CURL_COUNT="$curl_count" \
    TEST_CURL_LOG="$curl_log" \
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
  curl_log="$case_root/curl.log"

  mkdir -p "$deploy_root/releases"
  printf 'production configuration\n' >"$deploy_root/.env.production"
  chmod 600 "$deploy_root/.env.production"
  make_release "$deploy_root/releases/.incoming-new"
  make_fakes "$fake_dir"
  : >"$command_log"
  : >"$curl_log"

  PATH="$fake_dir:$PATH" \
    TEST_COMMAND_LOG="$command_log" \
    TEST_CURL_COUNT="$curl_count" \
    TEST_CURL_LOG="$curl_log" \
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
    "$deploy_root/releases/new/compose.production.yaml up -d --no-build --pull never --remove-orphans"
  assert_file_contains "$curl_log" \
    'curl --connect-timeout 2 --max-time 5 --fail --silent --show-error --output /dev/null'
}

run_rollback_case() {
  case_root=$1
  deploy_root="$case_root/deploy"
  fake_dir="$case_root/fakes"
  command_log="$case_root/commands.log"
  curl_count="$case_root/curl-count"
  curl_log="$case_root/curl.log"

  mkdir -p "$deploy_root/releases"
  printf 'production configuration\n' >"$deploy_root/.env.production"
  chmod 600 "$deploy_root/.env.production"
  make_release "$deploy_root/releases/old"
  make_release "$deploy_root/releases/.incoming-new"
  ln -s 'releases/old' "$deploy_root/current"
  make_fakes "$fake_dir"
  : >"$command_log"
  : >"$curl_log"

  if PATH="$fake_dir:$PATH" \
    TEST_COMMAND_LOG="$command_log" \
    TEST_CURL_COUNT="$curl_count" \
    TEST_CURL_LOG="$curl_log" \
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
    "$deploy_root/releases/old/compose.production.yaml up -d --no-build --pull never --remove-orphans"
  assert_count 4 'docker compose -p spark ' "$command_log"
  assert_count 21 'curl --connect-timeout 2 --max-time 5 ' "$curl_log"
}

run_workflow_failure_output_case() {
  case_root=$1
  fake_dir="$case_root/fakes"
  run_script="$case_root/remote-step.sh"
  deployment_output="$case_root/github-output"
  runner_temp="$case_root/runner-temp"

  mkdir -p "$fake_dir" "$runner_temp"
  extract_workflow_step 'Deploy release on ECS' "$run_script"
  cat >"$fake_dir/sshpass" <<'FAKE_SSHPASS'
#!/usr/bin/env bash
printf 'LOCAL_HEALTH_RESULT=failure\n'
printf 'ROLLBACK_RESULT=success\n'
exit 1
FAKE_SSHPASS
  chmod +x "$fake_dir/sshpass"
  : >"$deployment_output"

  set +e
  PATH="$fake_dir:$PATH" \
    ECS_DEPLOY_PATH=/opt/spark \
    ECS_HOST=example.test \
    ECS_PORT=22 \
    ECS_USER=deploy \
    RELEASE_ID=test-release \
    RUNNER_TEMP="$runner_temp" \
    GITHUB_OUTPUT="$deployment_output" \
    bash -e "$run_script"
  status=$?
  set -e

  [ "$status" -eq 1 ] || fail 'failed ECS deployment did not exit non-zero'
  assert_file_contains "$deployment_output" 'local_health=failure'
  assert_file_contains "$deployment_output" 'rollback=success'
}

run_public_timeout_case() {
  case_root=$1
  fake_dir="$case_root/fakes"
  run_script="$case_root/public-step.sh"
  public_output="$case_root/github-output"
  curl_log="$case_root/curl.log"

  mkdir -p "$fake_dir"
  extract_workflow_step 'Check public production readiness' "$run_script"
  cat >"$fake_dir/curl" <<'FAKE_PUBLIC_CURL'
#!/usr/bin/env bash
{
  printf 'curl'
  printf ' %s' "$@"
  printf '\n'
} >>"$TEST_CURL_LOG"
exit 1
FAKE_PUBLIC_CURL
  chmod +x "$fake_dir/curl"
  : >"$public_output"
  : >"$curl_log"

  set +e
  PATH="$fake_dir:$PATH" \
    ECS_HEALTHCHECK_URL=https://spark.example.test/ready \
    GITHUB_OUTPUT="$public_output" \
    TEST_CURL_LOG="$curl_log" \
    bash -e "$run_script"
  status=$?
  set -e

  [ "$status" -eq 1 ] || fail 'failed public readiness returned success'
  assert_file_contains "$public_output" 'result=failure'
  assert_file_contains "$curl_log" \
    'curl --connect-timeout 5 --max-time 10 --fail --show-error --silent'
}

test_root=$(mktemp -d)
trap 'rm -rf -- "$test_root"' EXIT HUP INT TERM

run_success_case "$test_root/success"
run_rollback_case "$test_root/rollback"
run_activation_failure_case "$test_root/activation-failure"
run_workflow_failure_output_case "$test_root/workflow-failure-output"
run_public_timeout_case "$test_root/public-timeout"

printf 'deploy-production tests passed\n'
