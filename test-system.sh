#!/bin/bash

# System test script for Dart Tournament Software
# Verifies backend API, database connection, and table structure

# Note: Not using set -e because test functions return non-zero on failure

# Configuration
BACKEND_URL="http://localhost:8000"
BACKEND_DIR="$HOME/dart-tournament-software/backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[✗]${NC} $1"
    ((TESTS_FAILED++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Test function wrapper
run_test() {
    ((TESTS_RUN++))
    if "$@"; then
        return 0
    else
        return 1
    fi
}

# Test 1: Check if backend is running
test_backend_running() {
    log_info "Testing if backend is running..."
    if curl -s -f "$BACKEND_URL/health" > /dev/null 2>&1; then
        log_success "Backend is running and responding"
        return 0
    else
        log_fail "Backend is not responding at $BACKEND_URL"
        return 1
    fi
}

# Test 2: Check backend health endpoint
test_health_endpoint() {
    log_info "Testing health endpoint..."
    RESPONSE=$(curl -s "$BACKEND_URL/health")

    if echo "$RESPONSE" | grep -q "healthy"; then
        log_success "Health endpoint returned 'healthy' status"
        return 0
    else
        log_fail "Health endpoint did not return expected status"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Test 3: Check root endpoint
test_root_endpoint() {
    log_info "Testing root endpoint..."
    RESPONSE=$(curl -s "$BACKEND_URL/")

    if echo "$RESPONSE" | grep -q "Dart Tournament API"; then
        log_success "Root endpoint returned expected message"
        return 0
    else
        log_fail "Root endpoint did not return expected message"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Test 4: Check database connection
test_database_connection() {
    log_info "Testing database connection..."

    # Activate venv and run a simple database query
    cd "$BACKEND_DIR" || return 1
    if [ ! -f "venv/bin/activate" ]; then
        log_fail "Virtual environment not found"
        return 1
    fi

    source venv/bin/activate || return 1

    PYTHON_TEST=$(python -c "
import asyncio
import sys
sys.path.insert(0, '/home/dart/dart-tournament-software')

async def test_db():
    try:
        from backend.core import get_session
        async with get_session() as session:
            from sqlalchemy import text
            result = await session.execute(text('SELECT 1'))
            return result.scalar() == 1
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        return False

result = asyncio.run(test_db())
print('SUCCESS' if result else 'FAILED')
" 2>&1)

    if echo "$PYTHON_TEST" | grep -q "SUCCESS"; then
        log_success "Database connection successful"
        return 0
    else
        log_fail "Database connection failed"
        echo "Error: $PYTHON_TEST"
        return 1
    fi
}

# Test 5: Check if all required tables exist
test_database_tables() {
    log_info "Testing database tables..."

    cd "$BACKEND_DIR" || return 1
    source venv/bin/activate || return 1

    PYTHON_TEST=$(python -c "
import asyncio
import sys
sys.path.insert(0, '/home/dart/dart-tournament-software')

async def test_tables():
    required_tables = [
        'players',
        'tournaments',
        'tournament_entries',
        'matches',
        'match_players',
        'games',
        'throws'
    ]

    try:
        from backend.core import get_session
        from sqlalchemy import text

        async with get_session() as session:
            missing_tables = []
            for table in required_tables:
                query = text('''
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_name = :table_name
                    )
                ''')
                result = await session.execute(query, {'table_name': table})
                exists = result.scalar()
                if not exists:
                    missing_tables.append(table)

            if missing_tables:
                print(f'MISSING: {\", \".join(missing_tables)}')
                return False
            else:
                print('SUCCESS')
                return True
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        return False

try:
    asyncio.run(test_tables())
except Exception as e:
    print(f'ERROR: {e}')
" 2>&1)

    if echo "$PYTHON_TEST" | grep -q "SUCCESS"; then
        log_success "All required database tables exist"
        return 0
    else
        log_fail "Some database tables are missing"
        echo "Result: $PYTHON_TEST"
        return 1
    fi
}

# Test 6: Test API endpoints
test_api_endpoints() {
    log_info "Testing API endpoints..."

    ENDPOINTS=(
        "/api/players"
        "/api/tournaments"
    )

    ALL_PASSED=true

    for endpoint in "${ENDPOINTS[@]}"; do
        STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL$endpoint")

        if [ "$STATUS_CODE" -eq 200 ] || [ "$STATUS_CODE" -eq 401 ]; then
            log_success "Endpoint $endpoint is accessible (HTTP $STATUS_CODE)"
        else
            log_fail "Endpoint $endpoint returned unexpected status: HTTP $STATUS_CODE"
            ALL_PASSED=false
        fi
    done

    if [ "$ALL_PASSED" = true ]; then
        return 0
    else
        return 1
    fi
}

# Test 7: Check environment configuration
test_environment() {
    log_info "Testing environment configuration..."

    # Check both root and backend directories for .env
    ENV_FILE=""
    ROOT_ENV="$HOME/dart-tournament-software/.env"
    BACKEND_ENV="$BACKEND_DIR/.env"

    if [ -f "$ROOT_ENV" ]; then
        ENV_FILE="$ROOT_ENV"
    elif [ -f "$BACKEND_ENV" ]; then
        ENV_FILE="$BACKEND_ENV"
    fi

    if [ -n "$ENV_FILE" ]; then
        log_success ".env file exists"

        # Check for required variables (simple grep, no complex regex)
        REQUIRED_VARS=("DATABASE_URL" "REDIS_URL" "SECRET_KEY")
        MISSING_VARS=()

        for var in "${REQUIRED_VARS[@]}"; do
            if grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
                :  # Variable found, do nothing
            else
                MISSING_VARS+=("$var")
            fi
        done

        if [ ${#MISSING_VARS[@]} -eq 0 ]; then
            log_success "All required environment variables are set"
            return 0
        else
            log_fail "Missing environment variables: ${MISSING_VARS[*]}"
            return 1
        fi
    else
        log_fail ".env file not found in root or backend directory"
        return 1
    fi
}

# Main test execution
main() {
    log_header "DART TOURNAMENT SOFTWARE - SYSTEM TEST"

    echo ""
    log_info "Starting system tests..."
    echo ""

    # Check if backend is running first
    if ! curl -s -f "$BACKEND_URL/health" > /dev/null 2>&1; then
        log_warn "Backend is not running. Some tests will be skipped."
        log_warn "Start the backend with: ./start-dev.sh"
        echo ""
        BACKEND_RUNNING=false
    else
        BACKEND_RUNNING=true
    fi

    # Environment tests (don't require running backend)
    log_header "ENVIRONMENT TESTS"
    run_test test_environment

    if [ "$BACKEND_RUNNING" = true ]; then
        # Backend API tests
        log_header "BACKEND API TESTS"
        run_test test_backend_running
        run_test test_health_endpoint
        run_test test_root_endpoint
        run_test test_api_endpoints

        # Database tests
        log_header "DATABASE TESTS"
        run_test test_database_connection
        run_test test_database_tables
    fi

    # Print summary
    log_header "TEST SUMMARY"
    echo ""
    echo "Tests run:    $TESTS_RUN"
    echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"

    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
        echo ""
        echo -e "${RED}Some tests failed. Please check the output above.${NC}"
        exit 1
    else
        echo -e "Tests failed: ${GREEN}0${NC}"
        echo ""
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo ""
        log_info "System is ready for development."
        echo ""
        log_info "Services:"
        log_info "  Backend API:       http://localhost:8000"
        log_info "  API Docs:          http://localhost:8000/docs"
        log_info "  Scoring Terminal:  http://localhost:3001"
        log_info "  Display Terminal:  http://localhost:3002"
        log_info "  Mobile App:        http://localhost:3003"
        echo ""
        exit 0
    fi
}

# Run main function
main
