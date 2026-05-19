<?php

if (!defined('ABSPATH')) {
    exit;
}

if ($this->is_enabled()): ?>
    <div class="apps-support-request">
     
    </div>
  

    <h3><?php echo $this->method_title; ?></h3>

    <?php echo (!empty($this->method_description)) ? wpautop($this->method_description) : ''; ?>

    <table class="form-table">
        <?php $this->generate_settings_html(); ?>
    </table>

    <?php
else: ?>
    <div class="inline error">
        <p>
            <strong><?php _e('Payment gateway is disabled', 'apps-payfast-woocommerce'); ?></strong>:
            <?php _e('PayFast does not support your store currency.', 'apps-payfast-woocommerce'); ?>
        </p>
    </div>
<?php endif;
