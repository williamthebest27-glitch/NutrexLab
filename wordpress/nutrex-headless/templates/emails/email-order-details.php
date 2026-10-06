<?php
/**
 * Nutrex Lab: riepilogo dell'ordine nelle email degli ordini Nutrex (prodotti con immagine, totali,
 * nota del cliente). Gli hook di WooCommerce restano: i metodi di pagamento (per esempio il bonifico)
 * aggiungono qui le loro istruzioni.
 *
 * @var WC_Order $order
 * @var bool     $sent_to_admin
 * @var bool     $plain_text
 * @var WC_Email $email
 */

defined( 'ABSPATH' ) || exit;

$nutrex_c    = NUTREX_HEADLESS_MAIL;
$nutrex_rule = '<tr><td colspan="2" style="padding:0;"><div style="height:1px;line-height:1px;font-size:1px;background:' . esc_attr( $nutrex_c['line'] ) . ';">&nbsp;</div></td></tr>';

/*
 * @hooked WC_Payment_Gateway::email_instructions() Istruzioni di pagamento (bonifico, contrassegno)
 */
do_action( 'woocommerce_email_before_order_table', $order, $sent_to_admin, $plain_text, $email );

$nutrex_date   = $order->get_date_created() ? wc_format_datetime( $order->get_date_created(), 'j F Y' ) : '';
$nutrex_number = sprintf( 'N. %s', $order->get_order_number() );
if ( $sent_to_admin ) {
	$nutrex_number = '<a href="' . esc_url( $order->get_edit_order_url() ) . '" style="color:' . esc_attr( $nutrex_c['berry'] ) . ';text-decoration:none;">' . esc_html( $nutrex_number ) . '</a>';
} else {
	$nutrex_number = esc_html( $nutrex_number );
}
?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
	<tr>
		<td style="padding:0 0 14px;" valign="bottom"><?php echo nutrex_headless_mail_label( $sent_to_admin ? 'Ordine' : 'Il tuo ordine' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></td>
		<td style="padding:0 0 14px;" valign="bottom" align="right"><?php echo nutrex_headless_mail_label( $nutrex_number . ( $nutrex_date ? ' &middot; ' . esc_html( $nutrex_date ) : '' ), 'right' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></td>
	</tr>
	<?php echo $nutrex_rule; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
	<tr>
		<td colspan="2" style="padding:6px 0;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
				<?php
				echo wc_get_email_order_items( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					$order,
					array(
						'show_sku'      => $sent_to_admin,
						'show_image'    => true,
						'image_size'    => array( 120, 120 ),
						'plain_text'    => $plain_text,
						'sent_to_admin' => $sent_to_admin,
					)
				);
				?>
			</table>
		</td>
	</tr>
	<?php echo $nutrex_rule; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
	<tr>
		<td colspan="2" style="padding:14px 0 0;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="nx-totals">
				<?php
				$nutrex_totals = $order->get_order_item_totals();
				$nutrex_last   = array_key_last( $nutrex_totals );
				foreach ( $nutrex_totals as $nutrex_key => $nutrex_total ) {
					$nutrex_is_total = $nutrex_key === $nutrex_last;
					$nutrex_label    = rtrim( wp_strip_all_tags( (string) $nutrex_total['label'] ), ': ' );
					$nutrex_color    = 'discount' === $nutrex_key ? $nutrex_c['berry'] : ( $nutrex_is_total ? $nutrex_c['ink'] : $nutrex_c['text'] );
					$nutrex_cell     = nutrex_headless_css(
						array(
							'padding'     => $nutrex_is_total ? '16px 0 0' : '5px 0',
							'border-top'  => $nutrex_is_total ? '1px solid ' . $nutrex_c['line'] : '0',
							'font-family' => $nutrex_c['font'],
							'font-size'   => $nutrex_is_total ? '18px' : '14px',
							'font-weight' => $nutrex_is_total ? '800' : '400',
							'color'       => $nutrex_color,
						)
					);
					?>
					<tr class="nx-total nx-total--<?php echo esc_attr( $nutrex_key ); ?>">
						<td style="<?php echo esc_attr( $nutrex_cell ); ?>" valign="top"><?php echo esc_html( $nutrex_label ); ?></td>
						<td style="<?php echo esc_attr( $nutrex_cell ); ?>text-align:right;" align="right" valign="top"><?php echo wp_kses_post( $nutrex_total['value'] ); ?></td>
					</tr>
					<?php
				}
				?>
			</table>
		</td>
	</tr>
</table>

<?php if ( $order->get_customer_note() ) : ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
	<tr>
		<td bgcolor="<?php echo esc_attr( $nutrex_c['soft'] ); ?>" style="<?php echo esc_attr( nutrex_headless_css( array( 'background' => $nutrex_c['soft'], 'border-radius' => '14px', 'padding' => '16px 20px' ) ) ); ?>">
			<?php echo nutrex_headless_mail_label( $sent_to_admin ? 'Nota del cliente' : 'La tua nota' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			<p style="<?php echo esc_attr( nutrex_headless_css( array( 'margin' => '0', 'font-family' => $nutrex_c['font'], 'font-size' => '14px', 'line-height' => '1.6', 'color' => $nutrex_c['ink'] ) ) ); ?>"><?php echo wp_kses( nl2br( wc_wptexturize_order_note( $order->get_customer_note() ) ), array( 'br' => array() ) ); ?></p>
		</td>
	</tr>
</table>
<?php endif; ?>

<?php
do_action( 'woocommerce_email_after_order_table', $order, $sent_to_admin, $plain_text, $email );
