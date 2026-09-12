#!/usr/bin/env bash

set -eu

script_dir=$(unset CDPATH; cd -- "$(dirname -- "$0")" && pwd)

usage() {
  cat >&2 <<'EOF'
usage:
  deploy-production.sh up <release-id> [deploy-root]
  deploy-production.sh stop [deploy-root]
  deploy-production.sh down [deploy-root]
  deploy-production.sh status [deploy-root]
EOF
  exit 2
}

redact_output() {
  sed -E \
    's/((password|secret|token|authorization|cookie)[^[:alnum:]]{1,3}).*/\1[REDACTED]/Ig'
}

compose_release() {
  release_dir=$1
  shift
  docker compose -p spark \
    --env-file "$deploy_root/.env.production" \
    --env-file "$release_dir/.env.release" \
    -f "$release_dir/compose.production.yaml" "$@"
}

wait_for_readiness() {
  attempt=1
  while [ "$attempt" -le 20 ]; do
    if curl --connect-timeout 2 --max-time 5 \
      --fail --silent --show-error --output /dev/null \
      http://127.0.0.1:18080/api/health/ready; then
      return 0
    fi
    if [ "$attempt" -lt 20 ]; then
      sleep 3
    fi
    attempt=$((attempt + 1))
  done
  return 1
}

diagnose_release() {
  release_dir=$1
  {
    compose_release "$release_dir" ps
    compose_release "$release_dir" logs --tail 100 postgres api web
  } 2>&1 | redact_output
}

action=${1:-}
case "$action" in
  up)
    case "$#" in
      2)
        deploy_root=$script_dir
        release_id=$2
        ;;
      3)
        release_id=$2
        deploy_root=$3
        ;;
      *) usage ;;
    esac
    ;;
  stop | down | status)
    case "$#" in
      1) deploy_root=$script_dir ;;
      2) deploy_root=$2 ;;
      *) usage ;;
    esac
    release_id=
    ;;
  *) usage ;;
esac

case "$deploy_root" in
  /*) ;;
  *)
    echo 'deploy root must be an absolute path' >&2
    exit 2
    ;;
esac

if [ "$deploy_root" = / ]; then
  echo 'deploy root cannot be the filesystem root' >&2
  exit 2
fi

if [ "$action" = up ] && ! [[ "$release_id" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo 'release id contains unsupported characters' >&2
  exit 2
fi

production_env="$deploy_root/.env.production"
releases_dir="$deploy_root/releases"
incoming_dir="$releases_dir/.incoming-$release_id"
final_dir="$releases_dir/$release_id"
current_link="$deploy_root/current"

[ -d "$deploy_root" ] || {
  echo "deploy root does not exist: $deploy_root" >&2
  exit 2
}
[ -d "$releases_dir" ] || {
  echo "releases directory does not exist: $releases_dir" >&2
  exit 2
}
[ -f "$production_env" ] || {
  echo "production environment file is missing: $production_env" >&2
  exit 2
}

production_mode=$(stat -c '%a' -- "$production_env")
if ! [[ "$production_mode" =~ ^[0-7]{3,4}$ ]] ||
  [ $((8#$production_mode & 077)) -ne 0 ]; then
  echo '.env.production must not be accessible by group or other users' >&2
  exit 2
fi

previous_dir=
if [ -L "$current_link" ]; then
  previous_target=$(readlink -- "$current_link")
  previous_id=${previous_target#releases/}
  if [ "$previous_target" = "$previous_id" ] ||
    ! [[ "$previous_id" =~ ^[A-Za-z0-9._-]+$ ]] ||
    [ "$previous_target" != "releases/$previous_id" ]; then
    echo 'current must point to a versioned release under releases/' >&2
    exit 2
  fi
  previous_dir="$releases_dir/$previous_id"
  for required_file in compose.production.yaml .env.release; do
    [ -f "$previous_dir/$required_file" ] || {
      echo "current release file is missing: $required_file" >&2
      exit 2
    }
  done
elif [ -e "$current_link" ]; then
  echo 'current exists but is not a symbolic link' >&2
  exit 2
fi

if [ "$action" != up ]; then
  [ -n "$previous_dir" ] || {
    echo 'current release is not configured' >&2
    exit 2
  }
  case "$action" in
    status) compose_release "$previous_dir" ps ;;
    stop) compose_release "$previous_dir" stop ;;
    down) compose_release "$previous_dir" down ;;
  esac
  exit 0
fi

if [ -d "$final_dir" ] && [ "$previous_dir" = "$final_dir" ]; then
  echo "Release is already active; ensuring services are running: $release_id" >&2
  if compose_release "$final_dir" up -d --no-build --pull never --remove-orphans &&
    wait_for_readiness; then
    echo 'LOCAL_HEALTH_RESULT=success'
    echo 'ROLLBACK_RESULT=not-needed'
    exit 0
  fi
  echo 'Active release failed readiness check' >&2
  diagnose_release "$final_dir"
  echo 'LOCAL_HEALTH_RESULT=failure'
  echo 'ROLLBACK_RESULT=not-needed'
  exit 1
fi

candidate_dir=
if [ -d "$incoming_dir" ]; then
  [ ! -e "$final_dir" ] && [ ! -L "$final_dir" ] || {
    echo "release already exists: $final_dir" >&2
    exit 2
  }
  candidate_dir=$incoming_dir
elif [ -d "$final_dir" ] && [ "$previous_dir" != "$final_dir" ]; then
  candidate_dir=$final_dir
  echo "Retrying prepared release: $final_dir" >&2
else
  echo "release candidate is missing: $incoming_dir" >&2
  exit 2
fi
for required_file in compose.production.yaml .env.release release.json; do
  [ -f "$candidate_dir/$required_file" ] || {
    echo "incoming release file is missing: $required_file" >&2
    exit 2
  }
done
if [ "$candidate_dir" = "$incoming_dir" ]; then
  mv -- "$incoming_dir" "$final_dir"
fi

local_health=failure
if compose_release "$final_dir" up -d --no-build --pull never --remove-orphans &&
  wait_for_readiness; then
  local_health=success
  temporary_link="$deploy_root/.current-$release_id.$$"
  trap 'rm -f -- "$temporary_link"' EXIT HUP INT TERM
  if ln -s "releases/$release_id" "$temporary_link" &&
    mv -Tf -- "$temporary_link" "$current_link"; then
    trap - EXIT HUP INT TERM
    echo 'LOCAL_HEALTH_RESULT=success'
    echo 'ROLLBACK_RESULT=not-needed'
    exit 0
  fi
  rm -f -- "$temporary_link"
  trap - EXIT HUP INT TERM
  echo 'Failed to update current release link' >&2
fi

echo 'Candidate release could not be activated' >&2
diagnose_release "$final_dir"

rollback_result=
if [ -n "$previous_dir" ]; then
  if compose_release "$previous_dir" up -d --no-build --pull never --remove-orphans &&
    wait_for_readiness; then
    rollback_result=success
    echo 'Previous release restored after candidate failure' >&2
  else
    echo 'Previous release failed local readiness during rollback' >&2
    diagnose_release "$previous_dir"
    rollback_result=failure
  fi
else
  if compose_release "$final_dir" down; then
    rollback_result=no-previous-release-candidate-stopped
  else
    rollback_result=no-previous-release-stop-failed
  fi
fi

if [ -d "$final_dir" ] && [ ! -e "$incoming_dir" ]; then
  if ! mv -- "$final_dir" "$incoming_dir"; then
    echo 'Failed to restore candidate release directory for retry' >&2
    rollback_result="$rollback_result-candidate-restore-failed"
  fi
fi

echo "LOCAL_HEALTH_RESULT=$local_health"
echo "ROLLBACK_RESULT=$rollback_result"
exit 1
