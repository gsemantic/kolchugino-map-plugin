<?php
/**
 * Улучшенная система логирования для плагина Кольчугино карта
 * 
 * Особенности:
 * - Настраиваемый уровень логирования через опции WordPress
 * - Автоматическая ротация логов (10MB лимит)
 * - Автоочистка старых бэкапов (хранятся 7 дней)
 * - Поддержка контекста и трассировки исключений
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class KOLCHUGINO_MAP_Logger {

    // Уровни логирования
    const EMERGENCY = 'emergency';
    const ALERT     = 'alert';
    const CRITICAL  = 'critical';
    const ERROR     = 'error';
    const WARNING   = 'warning';
    const NOTICE    = 'notice';
    const INFO      = 'info';
    const DEBUG     = 'debug';

    // Максимальный размер файла лога (10MB)
    const MAX_LOG_SIZE = 10485760;
    
    // Хранение бэкапов логов (дней)
    const LOG_BACKUP_RETENTION_DAYS = 7;

    private static $instance = null;
    private $log_enabled = false;
    private $log_level = self::WARNING; // По умолчанию только предупреждения и ошибки
    private $log_file = null;
    private $max_backups = 5; // Максимум 5 бэкапов

    private function __construct() {
        $this->init();
    }

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function init() {
        // Проверяем настройки плагина
        $saved_level = get_option( 'kolchugino_map_log_level', false );
        
        // Если WP_DEBUG включен
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            $this->log_enabled = true;
            
            // Используем сохраненный уровень или определяем по WP_DEBUG_LOG
            if ( $saved_level && defined( $saved_level ) ) {
                $this->log_level = constant( $saved_level );
            } elseif ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
                $this->log_level = self::INFO;
            }
            
            // Устанавливаем путь к файлу лога
            $upload_dir = wp_upload_dir();
            $this->log_file = $upload_dir['basedir'] . '/kolchugino-map/kolchugino-map.log';
            
            // Создаем директорию если не существует
            $log_dir = dirname( $this->log_file );
            if ( ! file_exists( $log_dir ) ) {
                wp_mkdir_p( $log_dir );
            }
            
            // Планируем очистку старых логов
            add_action( 'kolchugino_map_cleanup_logs', array( $this, 'cleanup_old_logs' ) );
            
            // Проверяем нужно ли запустить очистку
            if ( ! wp_next_scheduled( 'kolchugino_map_cleanup_logs' ) ) {
                wp_schedule_event( time(), 'daily', 'kolchugino_map_cleanup_logs' );
            }
        }
    }

    /**
     * Логирование сообщения
     */
    public function log( $level, $message, $context = array() ) {
        if ( ! $this->log_enabled || ! $this->should_log( $level ) ) {
            return;
        }

        $timestamp = current_time( 'mysql' );
        $log_entry = sprintf(
            '[%s] [%s] %s',
            $timestamp,
            strtoupper( $level ),
            $message
        );

        // Добавляем контекст, если есть (санитизируем данные)
        if ( ! empty( $context ) ) {
            // Удаляем чувствительные данные из контекста
            $safe_context = $this->sanitize_context( $context );
            $log_entry .= ' ' . wp_json_encode( $safe_context );
        }

        // Добавляем информацию о запросе (только безопасные данные)
        if ( isset( $_SERVER['REQUEST_METHOD'] ) ) {
            $log_entry .= ' | Method: ' . sanitize_text_field( $_SERVER['REQUEST_METHOD'] );
        }
        
        if ( isset( $_SERVER['REQUEST_URI'] ) ) {
            $log_entry .= ' | URI: ' . esc_url_raw( $_SERVER['REQUEST_URI'] );
        }
        
        // Добавляем ID пользователя (без персональных данных)
        if ( get_current_user_id() ) {
            $log_entry .= ' | User ID: ' . get_current_user_id();
        }

        // Записываем в файл
        $this->write_to_file( $log_entry );

        // Также выводим в системный лог для критических ошибок
        if ( $level === self::ERROR || $level === self::CRITICAL || $level === self::EMERGENCY ) {
            error_log( '[Kolchugino Map] ' . $message );
        }
    }

    /**
     * Санитизация контекста перед логированием
     */
    private function sanitize_context( $context ) {
        $sensitive_keys = array( 'password', 'secret', 'token', 'api_key', 'apikey', 'auth' );
        
        foreach ( $context as $key => $value ) {
            // Проверяем ключ на чувствительность
            foreach ( $sensitive_keys as $sensitive ) {
                if ( stripos( $key, $sensitive ) !== false ) {
                    $context[$key] = '***REDACTED***';
                    break;
                }
            }
            
            // Рекурсивная обработка массивов
            if ( is_array( $value ) ) {
                $context[$key] = $this->sanitize_context( $value );
            }
        }
        
        return $context;
    }

    /**
     * Проверяем, нужно ли логировать на этом уровне
     */
    private function should_log( $level ) {
        $levels = array(
            self::EMERGENCY => 0,
            self::ALERT     => 1,
            self::CRITICAL  => 2,
            self::ERROR     => 3,
            self::WARNING   => 4,
            self::NOTICE    => 5,
            self::INFO      => 6,
            self::DEBUG     => 7,
        );

        return isset( $levels[$level] ) && $levels[$level] <= $levels[$this->log_level];
    }

    /**
     * Запись в файл с ротацией
     */
    private function write_to_file( $message ) {
        if ( ! $this->log_file ) {
            return;
        }

        // Проверяем размер файла и ротируем при необходимости
        if ( file_exists( $this->log_file ) && filesize( $this->log_file ) > self::MAX_LOG_SIZE ) {
            $this->rotate_log();
        }

        // Записываем сообщение с блокировкой
        file_put_contents( $this->log_file, $message . PHP_EOL, FILE_APPEND | LOCK_EX );
    }

    /**
     * Ротация файла лога
     */
    private function rotate_log() {
        if ( ! file_exists( $this->log_file ) ) {
            return;
        }

        $backup_file = $this->log_file . '.' . date( 'Y-m-d_H-i-s' ) . '.bak';
        rename( $this->log_file, $backup_file );
        
        kolchugino_log()->info( 'Log rotated', array( 'backup_file' => basename( $backup_file ) ) );
    }

    /**
     * Очистка старых бэкапов логов
     */
    public function cleanup_old_logs() {
        if ( ! $this->log_file ) {
            return;
        }
        
        $log_dir = dirname( $this->log_file );
        $backup_pattern = $log_dir . '/kolchugino-map.*.bak';
        $backups = glob( $backup_pattern );
        
        if ( ! $backups ) {
            return;
        }
        
        $current_time = time();
        $retention_seconds = self::LOG_BACKUP_RETENTION_DAYS * DAY_IN_SECONDS;
        $deleted_count = 0;
        
        foreach ( $backups as $backup ) {
            // Проверяем возраст файла
            if ( file_exists( $backup ) && ( $current_time - filemtime( $backup ) > $retention_seconds ) ) {
                unlink( $backup );
                $deleted_count++;
            }
        }
        
        // Также ограничиваем количество бэкапов
        if ( count( $backups ) - $deleted_count > $this->max_backups ) {
            // Сортируем по времени создания
            usort( $backups, function( $a, $b ) {
                return filemtime( $a ) - filemtime( $b );
            });
            
            // Удаляем самые старые
            $to_delete = count( $backups ) - $this->max_backups;
            for ( $i = 0; $i < $to_delete; $i++ ) {
                if ( file_exists( $backups[$i] ) ) {
                    unlink( $backups[$i] );
                }
            }
        }
        
        if ( $deleted_count > 0 ) {
            kolchugino_log()->info( 'Cleaned up old log backups', array( 'deleted' => $deleted_count ) );
        }
    }

    /**
     * Удобные методы для разных уровней
     */
    public function emergency( $message, $context = array() ) {
        $this->log( self::EMERGENCY, $message, $context );
    }

    public function alert( $message, $context = array() ) {
        $this->log( self::ALERT, $message, $context );
    }

    public function critical( $message, $context = array() ) {
        $this->log( self::CRITICAL, $message, $context );
    }

    public function error( $message, $context = array() ) {
        $this->log( self::ERROR, $message, $context );
    }

    public function warning( $message, $context = array() ) {
        $this->log( self::WARNING, $message, $context );
    }

    public function notice( $message, $context = array() ) {
        $this->log( self::NOTICE, $message, $context );
    }

    public function info( $message, $context = array() ) {
        $this->log( self::INFO, $message, $context );
    }

    public function debug( $message, $context = array() ) {
        $this->log( self::DEBUG, $message, $context );
    }

    /**
     * Логирование исключений
     */
    public function log_exception( $exception, $context = array() ) {
        $message = sprintf(
            'Exception: %s in %s:%d',
            $exception->getMessage(),
            $exception->getFile(),
            $exception->getLine()
        );
        
        $context['trace'] = $exception->getTraceAsString();
        
        $this->error( $message, $context );
    }

    /**
     * Логирование SQL запросов (только в debug режиме)
     */
    public function log_query( $query, $execution_time = null ) {
        if ( $this->log_level !== self::DEBUG ) {
            return;
        }
        
        $context = array( 'query' => $query );
        
        if ( $execution_time !== null ) {
            $context['execution_time'] = $execution_time . 's';
        }
        
        $this->debug( 'SQL Query', $context );
    }

    /**
     * Очистка текущего лога
     */
    public function clear_logs() {
        if ( $this->log_file && file_exists( $this->log_file ) ) {
            unlink( $this->log_file );
            $this->info( 'Log file cleared manually' );
        }
    }

    /**
     * Получение статистики логов
     */
    public function get_log_stats() {
        if ( ! $this->log_file || ! file_exists( $this->log_file ) ) {
            return array( 
                'size' => 0, 
                'lines' => 0,
                'size_formatted' => '0 B',
                'backups' => 0
            );
        }

        $size = filesize( $this->log_file );
        $lines = count( file( $this->log_file ) );
        
        // Считаем бэкапы
        $log_dir = dirname( $this->log_file );
        $backups = glob( $log_dir . '/kolchugino-map.*.bak' );

        return array(
            'size' => $size,
            'lines' => $lines,
            'size_formatted' => size_format( $size ),
            'backups' => count( $backups ),
            'last_modified' => date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), filemtime( $this->log_file ) )
        );
    }
    
    /**
     * Установка уровня логирования
     */
    public function set_log_level( $level ) {
        $valid_levels = array(
            self::EMERGENCY, self::ALERT, self::CRITICAL, self::ERROR,
            self::WARNING, self::NOTICE, self::INFO, self::DEBUG
        );
        
        if ( in_array( $level, $valid_levels ) ) {
            $this->log_level = constant( __CLASS__ . '::' . strtoupper( $level ) );
            update_option( 'kolchugino_map_log_level', __CLASS__ . '::' . strtoupper( $level ) );
            return true;
        }
        
        return false;
    }
}

// Глобальная функция для удобного доступа
function kolchugino_log() {
    return KOLCHUGINO_MAP_Logger::get_instance();
}