#!/bin/bash

# Скрипт для синхронизации проекта с GitHub репозиторием
# Использование: ./sync-to-github.sh [commit_message]

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для вывода сообщений
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка токена GitHub
check_github_token() {
    if [[ -z "$GITHUB_TOKEN" ]]; then
        log_error "Переменная окружения GITHUB_TOKEN не установлена"
        log_info "Установите токен: export GITHUB_TOKEN=ваш_токен"
        exit 1
    fi
}

# Проверка Git репозитория
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_warning "Git репозиторий не найден. Инициализация..."
        git init
    fi
}

# Добавление удаленного репозитория
add_remote() {
    if ! git remote -v | grep -q "origin"; then
        log_info "Добавление удаленного репозитория..."
        git remote add origin https://github.com/pavlovigor88-alt/kolchugino-map-plugin.git
    fi
}

# Основная функция синхронизации
sync_to_github() {
    local commit_message="$1"
    
    # Проверка токена
    check_github_token
    
    # Проверка Git репозитория
    check_git_repo
    
    # Добавление удаленного репозитория
    add_remote
    
    log_info "Начало синхронизации с GitHub..."
    
    # Получение изменений с сервера
    log_info "Получение изменений с сервера..."
    if ! git pull origin main --no-rebase; then
        log_warning "Конфликт при pull. Попытка разрешения..."
        # Здесь можно добавить логику разрешения конфликтов
    fi
    
    # Добавление всех изменений
    log_info "Добавление изменений в индекс..."
    git add .
    
    # Проверка наличия изменений
    if ! git diff --cached --quiet; then
        # Создание коммита
        if [[ -z "$commit_message" ]]; then
            commit_message="Синхронизация проекта $(date '+%Y-%m-%d %H:%M:%S')"
        fi
        
        log_info "Создание коммита: $commit_message"
        git commit -m "$commit_message"
        
        # Отправка на сервер
        log_info "Отправка изменений на GitHub..."
        if ! git push origin main; then
            log_error "Ошибка при отправке на GitHub"
            exit 1
        fi
    else
        log_info "Нет изменений для коммита"
    fi
    
    # Синхронизация с удаленной веткой
    log_info "Синхронизация с удаленной веткой..."
    git fetch origin
    
    log_success "Синхронизация завершена успешно!"
}

# Функция для просмотра статуса
show_status() {
    log_info "Текущий статус Git:"
    git status
    
    echo ""
    log_info "Последние коммиты:"
    git log --oneline -5
}

# Функция для просмотра разницы
show_diff() {
    log_info "Неотслеживаемые файлы:"
    git status --porcelain | grep "^??"
    
    echo ""
    log_info "Измененные файлы:"
    git status --porcelain | grep "^ M"
    
    echo ""
    log_info "Статистика изменений:"
    git diff --stat
}

# Функция для просмотра веток
show_branches() {
    log_info "Ветки:"
    git branch -a
}

# Функция для просмотра удаленных репозиториев
show_remotes() {
    log_info "Удаленные репозитории:"
    git remote -v
}

# Меню помощи
show_help() {
    echo "Использование: $0 [опции] [сообщение_коммита]"
    echo ""
    echo "Опции:"
    echo "  -h, --help          Показать эту помощь"
    echo "  -s, --status        Показать статус Git"
    echo "  -d, --diff          Показать разницу"
    echo "  -b, --branches      Показать ветки"
    echo "  -r, --remotes       Показать удаленные репозитории"
    echo "  --init              Инициализировать Git репозиторий"
    echo "  --add-remote        Добавить удаленный репозиторий"
    echo ""
    echo "Примеры:"
    echo "  $0 'Исправление бага с поиском'"
    echo "  $0 --status"
    echo "  $0 --diff"
    echo "  $0 --init"
}

# Основная логика
case "${1:-sync}" in
    -h|--help)
        show_help
        ;;
    -s|--status)
        show_status
        ;;
    -d|--diff)
        show_diff
        ;;
    -b|--branches)
        show_branches
        ;;
    -r|--remotes)
        show_remotes
        ;;
    --init)
        check_git_repo
        add_remote
        log_success "Git репозиторий настроен"
        ;;
    --add-remote)
        add_remote
        log_success "Удаленный репозиторий добавлен"
        ;;
    sync)
        sync_to_github "$2"
        ;;
    *)
        log_error "Неизвестная команда: $1"
        show_help
        exit 1
        ;;
esac