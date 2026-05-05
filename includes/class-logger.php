<?php
/**
 * Улучшенная система логирования для плагина Кольчугино карта
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

    private static $instance = null;
    private $log_enabled = false;
    private $log_level = self::DEBUG;
    private $log_file = null;

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
        // Проверяем, включен ли WP_DEBUG
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            $this->log_enabled = true;
            
            // Определяем уровень логирования
            if ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
                $this->log_level = self::INFO;
            }
            
            // Устанавливаем путь к файлу лога
            $this->log_file = WP_CONTENT_DIR . '/kolchugino-map.log';
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

        // Добавляем контекст, если есть
        if ( ! empty( $context ) ) {
            $log_entry .= ' ' . json_encode( $context );
        }

        // Добавляем информацию о запросе
        if ( isset( $_SERVER['REQUEST_METHOD'] ) ) {
            $log_entry .= ' | Method: ' . $_SERVER['REQUEST_METHOD'];
        }
        
        if ( isset( $_SERVER['REQUEST_URI'] ) ) {
            $log_entry .= ' | URI: ' . $_SERVER['REQUEST_URI'];
        }

        // Записываем в файл
        $this->write_to_file( $log_entry );

        // Также выводим в системный лог для критических ошибок
        if ( $level === self::ERROR || $level === self::CRITICAL ) {
            error_log( '[Kolchugino Map] ' . $message );
        }
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

        // Записываем сообщение
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
     * Логирование SQL запросов
     */
    public function log_query( $query, $execution_time = null ) {
        $context = array( 'query' => $query );
        
        if ( $execution_time !== null ) {
            $context['execution_time'] = $execution_time;
        }
        
        $this->debug( 'SQL Query', $context );
    }

    /**
     * Очистка логов
     */
    public function clear_logs() {
        if ( $this->log_file && file_exists( $this->log_file ) ) {
            unlink( $this->log_file );
        }
    }

    /**
     * Получение статистики логов
     */
    public function get_log_stats() {
        if ( ! $this->log_file || ! file_exists( $this->log_file ) ) {
            return array( 'size' => 0, 'lines' => 0 );
        }

        $size = filesize( $this->log_file );
        $lines = count( file( $this->log_file ) );

        return array(
            'size' => $size,
            'lines' => $lines,
            'size_formatted' => size_format( $size ),
        );
    }
}

// Глобальная функция для удобного доступа
function kolchugino_log() {
    return KOLCHUGINO_MAP_Logger::get_instance();
}