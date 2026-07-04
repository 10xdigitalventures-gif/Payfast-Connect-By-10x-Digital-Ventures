<?php

if (!defined('ABSPATH')) {
    exit;
}

class apps_payfast_Gateway_Request
{

    protected $gateway;
    protected $notify_url;

    public function __construct($gateway)
    {
        $this->gateway = $gateway;
        $this->notify_url = WC()->api_request_url('apps_payfast_Gateway');
    }

    private function get_payment_url($sandbox = false)
    {
        $payment_url = "https://ipg1.apps.net.pk/Ecommerce/api/Transaction/PostTransaction";
        return $payment_url;
    }

    public function generate_payfast_form($order, $sandbox = false)
    {
        $payfast_args = $this->get_payment_parameters($order);
        $payfast_form[] = '<form action="' . esc_url($this->get_payment_url()) . '" method="post" id="payfast_woocom_form">';

        foreach ($payfast_args as $key => $value) {
            $payfast_form[] = '<input type="hidden" name="' . esc_attr($key) . '" value="' . esc_attr($value) . '" />';
        }
        $payfast_form[] = '<input type="submit" class="button paydast-submit" name="" value="' . __('Pay via PayFast', 'payfast-woocommerce') . '" />';
        $payfast_form[] = '<a class="button payfast-cancel" href="' . esc_url($order->get_cancel_order_url()) . '">' . __('Cancel order', 'payfast-woocommerce') . '</a>';
        $payfast_form[] = '</form>';


        return implode('', $payfast_form);
    }

    private function get_payment_parameters($order)
    {


        $token = $this->payfast_payment_token($order->get_total(), $order->get_order_number());

        if (!$token) {
            wc_add_notice('Payment gateway could not be connected. Please contact merchant.');
            wp_redirect(wc_get_checkout_url());
            exit;
        }

        $site_url = get_site_url() . "/wc-api/CALLBACK?";


        $signatureRaw = sprintf(
            "%s:%s:%s:%s",
            $this->gateway->merchant_id,
            $this->gateway->security_key,
            $order->get_total(),
            $order->get_order_number()
        );

        $signature = hash('sha256', $signatureRaw);

        $successUrl = $site_url;
        $successUrl .= "redirect=Y&signature=" . $signature . "&order_id=" . $order->id;

        $failUrl = $site_url;
        $failUrl .= "redirect=Y&signature=" . $signature . "&order_id=" . $order->id;
        $orderDate = date('Y-m-d H:i:s', time());

        $order->update_meta_data(
            "_local_transaction",
            $signature
        );

        $order->update_meta_data(
            "PAYFAST_Store_ID",
            $this->gateway->store_id
        );

        $order->update_meta_data(
            "PAYFAST_Response_Key",
            ''
        );


        $order->update_meta_data(
            "Order_Date",
            $orderDate
        );

        $backend_callback = $site_url;
        $backend_callback .= "signature=" . $signature . "&order_id=" . $order->id;

        $order->save();

        $payload = array(
            'MERCHANT_ID' => $this->gateway->merchant_id,
            'MERCHANT_NAME' => $this->gateway->merchant_name,
            'TOKEN' => $token,
            'PROCCODE' => '00',
            'TXNAMT' => $order->get_total(),
            'CUSTOMER_MOBILE_NO' => $order->get_billing_phone(),
            'CUSTOMER_EMAIL_ADDRESS' => $order->get_billing_email(),
            'SIGNATURE' => $signature,
            'VERSION' => 'WOOCOM-PAYFAST-PAYMENT-1.0',
            'TXNDESC' => 'Products purchased from ' . get_bloginfo('name'),
            'SUCCESS_URL' => urlencode($successUrl),
            'FAILURE_URL' => urlencode($failUrl),
            'BASKET_ID' => $order->get_order_number(),
            'ORDER_DATE' => $orderDate,
            'CHECKOUT_URL' => urlencode($backend_callback),
            
            'TRAN_TYPE' => 'ECOMM_PURCHASE',
            'STORE_ID' => $this->gateway->store_id,
            'CURRENCY_CODE' =>  get_woocommerce_currency()
        );

        return $payload;
    }

    private function payfast_payment_token($totalAmount, $basketId)
    {
        $tokeurl = sprintf(
            "?MERCHANT_ID=%s&SECURED_KEY=%s&TXNAMT=%s&BASKET_ID=%s&CURRENCY_CODE=%s",
            $this->gateway->merchant_id,
            $this->gateway->security_key,
            $totalAmount,
            $basketId,
            get_woocommerce_currency()
        );

        return $this->get_apps_auth_token($tokeurl);
    }

    private function get_apps_auth_token($urlParams)
    {

        $token_url = "https://ipg1.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken" . $urlParams;

        $data = array();
        $jsonpayload = json_encode($data);
        $response = $this->curl_request($token_url, $jsonpayload);
        $response_decode = json_decode($response);

        if (isset($response_decode->ACCESS_TOKEN)) {
            return $response_decode->ACCESS_TOKEN;
        }
        return null;
    }

    private function curl_request($url, $data_string)
    {

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'application/json; charset=utf-8    '
        ));
        curl_setopt($ch, CURLOPT_USERAGENT, 'WooCommerce-WordPress PayFast Plugin');
        $response = curl_exec($ch);
        curl_close($ch);
        return $response;
    }
}
