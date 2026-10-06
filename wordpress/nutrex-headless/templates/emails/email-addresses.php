<?php
/**
 * Nutrex Lab: indirizzi di spedizione e fatturazione nelle email degli ordini Nutrex.
 *
 * @var WC_Order $order
 * @var bool     $sent_to_admin
 */

defined( 'ABSPATH' ) || exit;

$nutrex_c        = NUTREX_HEADLESS_MAIL;
$nutrex_billing  = $order->get_formatted_billing_address();
$nutrex_shipping = ! wc_ship_to_billing_address_only() && $order->needs_shipping_address() ? $order->get_formatted_shipping_address() : '';
$nutrex_text     = nutrex_headless_css( array( 'margin' => '0', 'font-family' => $nutrex_c['font'], 'font-size' => '14px', 'line-height' => '1.6', 'color' => $nutrex_c['text'], 'font-style' => 'normal' ) );

$nutrex_columns = array();
if ( $nutrex_shipping ) {
	$nutrex_columns[] = array( 'Spedizione', 'shipping', $nutrex_shipping, $order->get_shipping_phone(), '' );
}
$nutrex_columns[] = array( $nutrex_shipping ? 'Fatturazione' : 'I tuoi dati', 'billing', $nutrex_billing ? $nutrex_billing : '&ndash;', $order->get_billing_phone(), $order->get_billing_email() );
?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
	<tr>
		<td colspan="2" style="padding:0 0 18px;"><div style="height:1px;line-height:1px;font-size:1px;background:<?php echo esc_attr( $nutrex_c['line'] ); ?>;">&nbsp;</div></td>
	</tr>
	<tr>
		<?php foreach ( $nutrex_columns as list( $nutrex_label, $nutrex_type, $nutrex_address, $nutrex_phone, $nutrex_email ) ) : ?>
		<td class="nx-col" valign="top" width="50%" style="width:50%;padding:0 16px 0 0;">
			<?php echo nutrex_headless_mail_label( $nutrex_label ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			<address style="<?php echo esc_attr( $nutrex_text ); ?>">
				<?php echo wp_kses_post( $nutrex_address ); ?>
				<?php if ( $nutrex_phone ) : ?>
					<br><?php echo wp_kses_post( wc_make_phone_clickable( $nutrex_phone ) ); ?>
				<?php endif; ?>
				<?php if ( $nutrex_email ) : ?>
					<br><?php echo esc_html( $nutrex_email ); ?>
				<?php endif; ?>
				<?php do_action( 'woocommerce_email_customer_address_section', $nutrex_type, $order, $sent_to_admin, false ); ?>
			</address>
		</td>
		<?php endforeach; ?>
		<?php if ( 1 === count( $nutrex_columns ) ) : ?>
		<td class="nx-col" width="50%" style="width:50%;">&nbsp;</td>
		<?php endif; ?>
	</tr>
</table>
