<?php
/**
 * Nutrex Lab: righe dei prodotti nelle email degli ordini Nutrex (immagine, nome, varianti,
 * quantita' e importo). Gli hook di WooCommerce restano: altri plugin possono aggiungere informazioni.
 *
 * @var WC_Order $order
 * @var array    $items
 * @var bool     $show_sku
 * @var bool     $show_purchase_note
 * @var bool     $show_image
 * @var array    $image_size
 * @var bool     $plain_text
 * @var bool     $sent_to_admin
 */

defined( 'ABSPATH' ) || exit;

$nutrex_c     = NUTREX_HEADLESS_MAIL;
$nutrex_first = true;

foreach ( $items as $item_id => $item ) :
	if ( ! apply_filters( 'woocommerce_order_item_visible', true, $item ) ) {
		continue;
	}
	$product       = $item->get_product();
	$sku           = is_object( $product ) ? $product->get_sku() : '';
	$purchase_note = is_object( $product ) ? $product->get_purchase_note() : '';
	$image_id      = is_object( $product ) ? $product->get_image_id() : 0;
	$image_url     = $image_id ? wp_get_attachment_image_url( $image_id, 'woocommerce_thumbnail' ) : '';

	$qty          = $item->get_quantity();
	$refunded_qty = $order->get_qty_refunded_for_item( $item_id );
	$qty_display  = $refunded_qty ? '<del>' . esc_html( $qty ) . '</del> ' . esc_html( $qty - ( $refunded_qty * -1 ) ) : esc_html( $qty );
	$quantity     = apply_filters( 'woocommerce_email_order_item_quantity', $qty_display, $item );

	$pad = $nutrex_first ? '10px' : '16px';
	$nutrex_first = false;
	?>
	<tr class="<?php echo esc_attr( apply_filters( 'woocommerce_order_item_class', 'order_item', $item, $order ) ); ?>">
		<?php if ( $show_image ) : ?>
		<td class="nx-thumb" width="76" valign="top" style="width:76px;padding:<?php echo esc_attr( $pad ); ?> 0 10px;">
			<?php if ( $image_url ) : ?>
				<img src="<?php echo esc_url( $image_url ); ?>" width="64" height="64" alt="<?php echo esc_attr( wp_strip_all_tags( $item->get_name() ) ); ?>" style="display:block;width:64px;height:64px;border-radius:14px;border:0;object-fit:cover;background:<?php echo esc_attr( $nutrex_c['soft'] ); ?>;">
			<?php else : ?>
				<div style="width:64px;height:64px;border-radius:14px;background:<?php echo esc_attr( $nutrex_c['soft'] ); ?>;">&nbsp;</div>
			<?php endif; ?>
		</td>
		<?php endif; ?>
		<td valign="top" style="padding:<?php echo esc_attr( $pad ); ?> 12px 10px 0;font-family:<?php echo esc_attr( $nutrex_c['font'] ); ?>;">
			<p style="margin:0 0 4px;font-size:15px;line-height:1.35;font-weight:700;color:<?php echo esc_attr( $nutrex_c['ink'] ); ?>;">
				<?php echo wp_kses_post( apply_filters( 'woocommerce_order_item_name', $item->get_name(), $item, false ) ); ?>
				<?php if ( $show_sku && $sku ) : ?>
					<span style="font-weight:400;color:<?php echo esc_attr( $nutrex_c['muted'] ); ?>;">&nbsp;(<?php echo esc_html( $sku ); ?>)</span>
				<?php endif; ?>
			</p>
			<?php
			do_action( 'woocommerce_order_item_meta_start', $item_id, $item, $order, $plain_text );
			$item_meta = wc_display_item_meta(
				$item,
				array(
					'before'       => '',
					'after'        => '',
					'separator'    => '<br>',
					'echo'         => false,
					'label_before' => '<span>',
					'label_after'  => ':</span> ',
				)
			);
			if ( $item_meta ) {
				echo '<p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:' . esc_attr( $nutrex_c['muted'] ) . ';">' . wp_kses( $item_meta, array( 'br' => array(), 'span' => array(), 'a' => array( 'href' => true, 'target' => true, 'rel' => true ) ) ) . '</p>';
			}
			if ( '' !== $quantity ) {
				echo '<p style="margin:0;font-size:13px;line-height:1.5;color:' . esc_attr( $nutrex_c['muted'] ) . ';">Quantità: ' . wp_kses_post( $quantity ) . '</p>';
			}
			do_action( 'woocommerce_order_item_meta_end', $item_id, $item, $order, $plain_text );
			?>
		</td>
		<td valign="top" align="right" style="padding:<?php echo esc_attr( $pad ); ?> 0 10px;white-space:nowrap;font-family:<?php echo esc_attr( $nutrex_c['font'] ); ?>;font-size:15px;font-weight:700;color:<?php echo esc_attr( $nutrex_c['ink'] ); ?>;">
			<?php echo wp_kses_post( $order->get_formatted_line_subtotal( $item ) ); ?>
		</td>
	</tr>
	<?php if ( $show_purchase_note && $purchase_note ) : ?>
	<tr>
		<td colspan="<?php echo $show_image ? 3 : 2; ?>" style="padding:0 0 10px;font-family:<?php echo esc_attr( $nutrex_c['font'] ); ?>;font-size:13px;line-height:1.55;color:<?php echo esc_attr( $nutrex_c['text'] ); ?>;">
			<?php echo wp_kses_post( wpautop( do_shortcode( $purchase_note ) ) ); ?>
		</td>
	</tr>
	<?php endif; ?>
<?php endforeach; ?>
