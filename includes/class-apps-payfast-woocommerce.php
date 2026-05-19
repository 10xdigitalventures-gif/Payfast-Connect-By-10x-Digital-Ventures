<?php

if (!defined('ABSPATH')) {
    exit;
}

class apps_payfast_Woocommerce {

    protected $loader;
    protected $plugin_name;
    protected $version;

    public function __construct() {

        $this->plugin_name = 'apps-payfast-woocommerce';
        $this->version = '1.0';

        $this->load_dependencies();
        $this->define_admin_hooks();
    }

    private function load_dependencies() {

        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-apps-payfast-woocommerce-loader.php';

        require_once plugin_dir_path(dirname(__FILE__)) . 'admin/class-apps-payfast-gateway.php';

        $this->loader = new apps_payfast_Woocommerce_Loader();
    }

    private function define_admin_hooks() {
        $plugin_admin = new apps_payfast_Gateway();

        $this->loader->add_filter('woocommerce_payment_gateways', $plugin_admin, 'add_new_gateway');
        $this->loader->add_action('wp', $plugin_admin, 'set_wc_notice');

        add_action('woocommerce_update_options_payment_gateways_' . $plugin_admin->id, array($plugin_admin, 'process_admin_options'));
        add_action('woocommerce_receipt_apps_payfast_payment', array($plugin_admin, 'receipt_page'));
        add_action('woocommerce_api_callback', array($plugin_admin, 'payfast_response_handler'));
    }

    public function run() {
        $this->loader->run();
    }

    public function get_plugin_name() {
        return $this->plugin_name;
    }

    public function get_loader() {
        return $this->loader;
    }

    public function get_version() {
        return $this->version;
    }

}
