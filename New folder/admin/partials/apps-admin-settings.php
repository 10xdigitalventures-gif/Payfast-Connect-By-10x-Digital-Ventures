<?php

if (!defined('ABSPATH')) {
    exit;
}

return array(
    'enabled' => array(
        'title' => __('Enable/Disable', 'apps-payfast-woocommerce'),
        'type' => 'checkbox',
        'label' => __('Enable PayFast Payment Gateway', 'apps-payfast-woocommerce'),
        'description' => __('Enable or disable the gateway.', 'apps-payfast-woocommerce'),
        'desc_tip' => false,
        'default' => 'yes'
    ),
    'merchant_id' => array(
        'title' => __('Merchant ID', 'apps-payfast-woocommerce'),
        'type' => 'text',
        'label' => __('Registered Merchant ID at PayFast', 'apps-payfast-woocommerce'),
        'description' => __('Registered Merchant ID at PayFast.', 'apps-payfast-woocommerce'),
        'desc_tip' => true,
        'default' => '102'
    ),
    'security_key' => array(
        'title' => __('Merchant Secured Key', 'apps-payfast-woocommerce'),
        'type' => 'text',
        'description' => __('Merchant\'s security key.', 'apps-payfast-woocommerce'),
        'desc_tip' => true,
        'default' => 'zWHjBp2AlttNu1sK'
    ),
    'secret_word' => array(
        'title' => __('Merchant Secret Word', 'apps-payfast-woocommerce'),
        'type' => 'password',
        'description' => __('To be used for calculating response hash for data integrity after transaction completion. Should be set in Merchant Portal', 'apps-payfast-woocommerce'),
        'desc_tip' => true,
        'default' => ''
    ),
    'merchant_name' => array(
        'title' => __('Merchant Name', 'apps-payfast-woocommerce'),
        'type' => 'text',
        'description' => __('Merchant Name', 'apps-payfast-woocommerce'),
        'desc_tip' => true,
        'default' => 'Test Merchant'
    ),
    'store_id' => array(
        'title' => __('Store ID', 'apps-payfast-woocommerce'),
        'type' => 'text',
        'description' => __('Merchant\'s Store/Terminal/Outlet ID.', 'apps-payfast-woocommerce'),
        'desc_tip' => true,
        'default' => ''
    )
);
