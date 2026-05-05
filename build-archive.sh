#!/bin/bash

# Улучшенный скрипт сборки плагина с автоматическим определением и увеличением версии

MAIN_FILE="kolchugino-map.php"
SLUG="kolchugino-map-plugin"

# Функция для извлечения текущей версии
get_current_version() {
    # Ищем версию в главном файле плагина
    if [ -f "$MAIN_FILE" ]; then
        local version=$(grep -oP "^\s*\*\s*Version:\s*\K[\d]+\.[\d]+\.[\d]+" "$MAIN_FILE")
        if [ -n "$version" ]; then
            echo "$version"
            return 0
        fi
    fi
    
    # Альтернативный поиск в PHP константах
    local version=$(grep -oP "define\([^)]*VERSION[^)]*,\s*['\"]\K[\d]+\.[\d]+\.[\d]+['\"]" "$MAIN_FILE" | head -1)
    if [ -n "$version" ]; then
        echo "$version"
        return 0
    fi
    
    echo "1.0.0"  # Версия по умолчанию
    return 1
}

# Функция для увеличения версии
increment_version() {
    local current_version="$1"
    local version_type="$2"  # patch, minor, major
    
    # Разбираем версию на компоненты
    local major=$(echo "$current_version" | cut -d. -f1)
    local minor=$(echo "$current_version" | cut -d. -f2)
    local patch=$(echo "$current_version" | cut -d. -f3)
    
    case "$version_type" in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch"|*)
            patch=$((patch + 1))
            ;;
    esac
    
    echo "${major}.${minor}.${patch}"
}

# Проверяем аргументы
if [ -z "$1" ]; then
    echo "🔍 Определение текущей версии..."
    CURRENT_VERSION=$(get_current_version)
    echo "Текущая версия: $CURRENT_VERSION"
    
    echo ""
    echo "Выберите тип обновления версии:"
    echo "1) Patch (исправление) - x.x.1 (по умолчанию)"
    echo "2) Minor (добавление функционала) - x.1.x"
    echo "3) Major (существенные изменения) - 1.x.x"
    echo "4) Указать свою версию"
    
    read -p "Ваш выбор (1-4): " choice
    
    case $choice in
        1|"")
            NEW_VERSION=$(increment_version "$CURRENT_VERSION" "patch")
            version_type="patch"
            ;;
        2)
            NEW_VERSION=$(increment_version "$CURRENT_VERSION" "minor")
            version_type="minor"
            ;;
        3)
            NEW_VERSION=$(increment_version "$CURRENT_VERSION" "major")
            version_type="major"
            ;;
        4)
            read -p "Введите новую версию (например 1.3.6): " NEW_VERSION
            version_type="custom"
            ;;
        *)
            echo "❌ Неверный выбор. Используется patch-обновление."
            NEW_VERSION=$(increment_version "$CURRENT_VERSION" "patch")
            version_type="patch"
            ;;
    esac
else
    NEW_VERSION="$1"
    version_type="custom"
fi

echo ""
echo "🔄 Обновление версии до $NEW_VERSION (тип: $version_type)..."

# 1. Обновляем версию в главном заголовке плагина (ищет "* Version: x.x.x")
if [ -f "$MAIN_FILE" ]; then
    sed -i "s/\(\*[[:space:]]*Version:[[:space:]]*\)[0-9]\+\.[0-9]\+\.[0-9]\+/\1$NEW_VERSION/" "$MAIN_FILE"
    sed -i "s/\(define( *'KOLCHUGINO_MAP_VERSION', *'\)[0-9]\+\.[0-9]\+\.[0-9]\+/\1$NEW_VERSION/" "$MAIN_FILE"
    if grep -q "Version:[[:space:]]*$NEW_VERSION" "$MAIN_FILE"; then echo "✅ Версия успешно обновлена в заголовке и константе"; else echo "❌ ОШИБКА: sed не нашел строку Version! Проверь формат файла."; exit 1; fi
else
    echo "⚠️ Внимание: $MAIN_FILE не найден!"
fi

# 2. Обновляем Stable tag в readme.txt
if [ -f "readme.txt" ]; then
    sed -i "s/^\(Stable tag:\s*\)[0-9]\+\.[0-9]\+\.[0-9]\+/\1$NEW_VERSION/" "readme.txt"
    echo "✅ Обновлен Stable tag в readme.txt"
fi

# 3. Ищем и меняем версию в PHP-константах (например: define('MAP_VER', '1.3.5'))
# Ищет только паттерн с словом VERSION, чтобы не сломать координаты
find . -maxdepth 2 -name "*.php" -not -path "./vendor/*" -exec sed -i "s/\(define([^)]*VERSION[^)]*, *['\"]\)[0-9]\+\.[0-9]\+\.[0-9]\+\(['\"]\)/\1$NEW_VERSION\2/gi" {} +

# 4. Ищем и меняем хардкод версии в wp_enqueue_script и wp_enqueue_style
# Ищет паттерн: wp_enqueue_что-то('...', '...', [...], '1.3.5')
find . -maxdepth 2 -name "*.php" -not -path "./vendor/*" -exec sed -i "s/\(wp_enqueue_[a-z]*([^)]*['\"]\)[0-9]\+\.[0-9]\+\.[0-9]\+\(['\"]\)/\1$NEW_VERSION\2/gi" {} +

echo "✅ Поиск по PHP файлам завершен"

# 5. Создаем ZIP архив
ZIP_NAME="${SLUG}.${NEW_VERSION}.zip"

if [ -f "$ZIP_NAME" ]; then
    rm "$ZIP_NAME"
    echo "🗑️ Удален старый архив: $ZIP_NAME"
fi

# Собираем архив
echo "📦 Создание архива..."
zip -r "$ZIP_NAME" . \
    -x "*.git*" \
    -x "*.qwen*" \
    -x "*node_modules*" \
    -x "*.DS_Store" \
    -x "*build.sh" \
    -x "*project_dump.txt" \
    -x "*PROJECT_MAP.md" \
    -x "*composer.json" \
    -x "*package-lock.json" \
    -x "*phpunit.xml*" \
    -x "*.log" \
    -x "*.tmp"

echo ""
echo "=================================================="
echo "🎉 УСПЕХ! Готовый плагин: $ZIP_NAME"
echo "=================================================="

# Показать информацию о сборке
echo ""
echo "📋 Информация о сборке:"
echo "   • Старая версия: $CURRENT_VERSION"
echo "   • Новая версия: $NEW_VERSION"
echo "   • Тип обновления: $version_type"
echo "   • Размер архива: $(du -h "$ZIP_NAME" | cut -f1)"
echo ""
echo "🚀 Плагин готов к установке и распространению!"

# ВАЖНО: WordPress кэширует метаданные плагинов. Чтобы увидеть новую версию в админке, необходимо полностью переустановить плагин (удалить -> загрузить новый ZIP -> активировать) или очистить кеш сервера/плагинов кэширования.
