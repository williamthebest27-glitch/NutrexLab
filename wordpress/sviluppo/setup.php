<?php
/**
 * SOLO SVILUPPO LOCALE: prepara un WooCommerce di prova (WordPress Playground) per provare il negozio.
 * Prezzi, stock e codici sono finti e restano in questo WordPress temporaneo: in produzione i prodotti
 * si creano dal pannello WooCommerce di admin.nutrexlab.it.
 *
 * Crea: impostazioni del negozio (EUR, Italia, IVA), zona di spedizione Italia, categorie per formato,
 * i 12 prodotti con gli slug del sito (uno variabile, uno esaurito, due in offerta), un coupon, il
 * metodo di pagamento del plugin Nutrex Headless e una password applicazione per la REST API.
 */

require_once '/wordpress/wp-load.php';

if ( ! function_exists( 'WC' ) ) {
	throw new Exception( 'WooCommerce non attivo' );
}

// ---------------------------------------------------------------------------- impostazioni
$options = array(
	'blogname'                               => 'Nutrex Lab (prova locale)',
	'woocommerce_currency'                   => 'EUR',
	'woocommerce_currency_pos'               => 'right_space',
	'woocommerce_price_thousand_sep'         => '.',
	'woocommerce_price_decimal_sep'          => ',',
	'woocommerce_price_num_decimals'         => '2',
	'woocommerce_default_country'            => 'IT:MI',
	'woocommerce_allowed_countries'          => 'specific',
	'woocommerce_specific_allowed_countries' => array( 'IT' ),
	'woocommerce_ship_to_countries'          => '',
	'woocommerce_calc_taxes'                 => 'yes',
	'woocommerce_prices_include_tax'         => 'yes',
	'woocommerce_tax_display_shop'           => 'incl',
	'woocommerce_tax_display_cart'           => 'incl',
	'woocommerce_tax_based_on'               => 'shipping',
	'woocommerce_manage_stock'               => 'yes',
	'woocommerce_hold_stock_minutes'         => '60',
	'woocommerce_notify_low_stock_amount'    => '5',
	'woocommerce_stock_format'               => 'low_amount',
	'woocommerce_enable_guest_checkout'      => 'yes',
	'woocommerce_enable_coupons'             => 'yes',
	'woocommerce_coming_soon'                => 'no',
	'woocommerce_onboarding_profile'         => array( 'skipped' => true ),
);
foreach ( $options as $name => $value ) {
	update_option( $name, $value );
}

// IVA 22% (di prova: l'aliquota vera la imposta l'amministratore)
global $wpdb;
if ( ! $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}woocommerce_tax_rates" ) ) {
	WC_Tax::_insert_tax_rate(
		array(
			'tax_rate_country'  => 'IT',
			'tax_rate_state'    => '',
			'tax_rate'          => '22.0000',
			'tax_rate_name'     => 'IVA',
			'tax_rate_priority' => 1,
			'tax_rate_compound' => 0,
			'tax_rate_shipping' => 1,
			'tax_rate_order'    => 0,
			'tax_rate_class'    => '',
		)
	);
}

// zona di spedizione Italia: standard 4,90 EUR, gratuita da 60 EUR
$zones = WC_Shipping_Zones::get_zones();
if ( ! $zones ) {
	$zone = new WC_Shipping_Zone();
	$zone->set_zone_name( 'Italia' );
	$zone->add_location( 'IT', 'country' );
	$zone->save();
	$flat = $zone->add_shipping_method( 'flat_rate' );
	update_option(
		'woocommerce_flat_rate_' . $flat . '_settings',
		array( 'title' => 'Spedizione standard', 'tax_status' => 'taxable', 'cost' => '4.90' )
	);
	$free = $zone->add_shipping_method( 'free_shipping' );
	update_option(
		'woocommerce_free_shipping_' . $free . '_settings',
		array( 'title' => 'Spedizione gratuita', 'requires' => 'min_amount', 'min_amount' => '60', 'ignore_discounts' => 'no' )
	);
	WC_Cache_Helper::get_transient_version( 'shipping', true );
}

// plugin Nutrex Headless: negozio locale, categoria Nutrex, mittente delle email
update_option( 'nutrex_headless_frontend_url', 'http://127.0.0.1:5173' );
update_option( 'nutrex_headless_category', 'nutrex-lab' );
update_option( 'nutrex_headless_email_from_name', 'Nutrex Lab' );

// pagamento alla consegna e bonifico, solo per completare ordini di prova nel checkout locale
// (con il bonifico il cliente resta sulla pagina "Ordine ricevuto" di WooCommerce, con le istruzioni)
update_option(
	'woocommerce_cod_settings',
	array( 'enabled' => 'yes', 'title' => 'Pagamento alla consegna (prova)', 'description' => '', 'instructions' => '', 'enable_for_methods' => array(), 'enable_for_virtual' => 'yes' )
);
update_option(
	'woocommerce_bacs_settings',
	array( 'enabled' => 'yes', 'title' => 'Bonifico bancario (prova)', 'description' => '', 'instructions' => '' )
);

// ---------------------------------------------------------------------------- categorie
function nutrex_dev_category( $name, $slug, $parent = 0 ) {
	$term = get_term_by( 'slug', $slug, 'product_cat' );
	if ( $term ) {
		return (int) $term->term_id;
	}
	$res = wp_insert_term( $name, 'product_cat', array( 'slug' => $slug, 'parent' => $parent ) );
	return (int) $res['term_id'];
}
// WooCommerce condiviso: i prodotti Nutrex stanno sotto "Nutrex Lab" (WOOCOMMERCE_CATEGORY=nutrex-lab)
$root = nutrex_dev_category( 'Nutrex Lab', 'nutrex-lab' );
$cats = array(
	'powder'  => nutrex_dev_category( 'Polvere', 'polvere', $root ),
	'tablet'  => nutrex_dev_category( 'Compresse', 'compresse', $root ),
	'capsule' => nutrex_dev_category( 'Capsule', 'capsule', $root ),
);

// ---------------------------------------------------------------------------- immagini
function nutrex_dev_image( $slug ) {
	$src = '/import/prodotti/' . $slug . '.webp';
	if ( ! file_exists( $src ) ) {
		return 0;
	}
	$existing = get_posts( array( 'post_type' => 'attachment', 'name' => 'nutrex-' . $slug, 'numberposts' => 1, 'fields' => 'ids' ) );
	if ( $existing ) {
		return (int) $existing[0];
	}
	$upload = wp_upload_bits( 'nutrex-' . $slug . '.webp', null, file_get_contents( $src ) );
	if ( ! empty( $upload['error'] ) ) {
		return 0;
	}
	$id = wp_insert_attachment(
		array(
			'post_mime_type' => 'image/webp',
			'post_title'     => 'nutrex-' . $slug,
			'post_name'      => 'nutrex-' . $slug,
			'post_status'    => 'inherit',
		),
		$upload['file']
	);
	require_once ABSPATH . 'wp-admin/includes/image.php';
	wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $upload['file'] ) );
	return (int) $id;
}

// ---------------------------------------------------------------------------- prodotti
// slug = id del prodotto nel sito (src/products.js): colori, racconto 3D e link "Scopri"
$products = array(
	array( 'collagene', 'Collagene marino', 'powder', null, null, null, 'Collagene marino idrolizzato di tipo I con vitamina C, acido ialuronico, coenzima Q10 e biotina. 10.000 mg in ogni misurino.', '500 g' ),
	array( 'collagene-marino-compresse', 'Collagene marino compresse', 'tablet', '34.90', null, 80, 'Il tuo rituale, in tre compresse al giorno.', '180 compresse' ),
	array( 'collagene-bovino', 'Collagene bovino', 'tablet', '29.90', null, 60, 'Con acido ialuronico, vitamine e minerali.', '180 compresse' ),
	array( 'bromelina', 'Bromelina alto dosaggio', 'tablet', '24.90', null, 40, '1875 GDU in ogni compressa gastroprotetta.', '180 compresse' ),
	array( 'ashwagandha', 'Ashwagandha KSM-66', 'tablet', '22.90', null, 0, 'Pensata per il tuo benessere psicofisico.', '180 compresse' ),
	array( 'coenzima-q10', 'Coenzima Q10 Cardio Premium', 'capsule', '32.90', null, 4, 'Con acetil L-carnitina e biancospino.', '180 capsule' ),
	array( 'd-mannosio', 'D-Mannosio Uro Care', 'tablet', '27.90', null, 30, 'Con cranberry, uva ursina e probiotici.', '180 compresse' ),
	array( 'diosmina', 'Diosmina ed Esperidina', 'capsule', '25.90', null, 30, '1200 mg per dose, con estratto di vite rossa.', '180 capsule' ),
	array( 'magnesio', 'Magnesio bisglicinato', 'tablet', '19.90', '16.90', 50, 'Con vitamine B1, B6 e B12, in due compresse.', '180 compresse' ),
	array( 'vitamina-b12', 'Vitamina B12', 'tablet', '18.90', null, 50, 'Metilcobalamina, 1000 µg al giorno.', '450 compresse' ),
	array( 'vitamina-c', 'Vitamina C', 'tablet', '16.90', null, 50, 'Con rosa canina e bioflavonoidi.', '180 compresse' ),
	array( 'vitamina-d3-k2', 'Vitamina D3 + K2', 'tablet', '21.90', null, 50, '2000 UI e 100 µg in una compressa al giorno.', '365 compresse' ),
);

$i = 0;
foreach ( $products as $p ) {
	list( $slug, $name, $form, $price, $sale, $stock, $short, $pack ) = $p;
	++$i;
	if ( wc_get_product_id_by_sku( 'NUT-' . strtoupper( $slug ) ) || get_page_by_path( $slug, OBJECT, 'product' ) ) {
		continue;
	}
	$image = nutrex_dev_image( $slug );
	$attr  = new WC_Product_Attribute();
	$attr->set_name( 'Confezione' );
	$attr->set_options( array( $pack ) );
	$attr->set_visible( true );
	$attr->set_variation( false );

	if ( null === $price ) {
		// prodotto variabile: 1, 2 o 3 confezioni
		$product = new WC_Product_Variable();
		$product->set_name( $name );
		$product->set_slug( $slug );
		$product->set_sku( 'NUT-COLL-500' );
		$product->set_short_description( $short );
		$product->set_description( '<p>' . $short . '</p><p>Prodotto di prova del WooCommerce locale.</p>' );
		$product->set_category_ids( array( $cats[ $form ] ) );
		$product->set_menu_order( $i );
		if ( $image ) {
			$product->set_image_id( $image );
		}
		$qty = new WC_Product_Attribute();
		$qty->set_name( 'Quantità' );
		$qty->set_options( array( '1 confezione', '2 confezioni', '3 confezioni' ) );
		$qty->set_visible( true );
		$qty->set_variation( true );
		$product->set_attributes( array( $attr, $qty ) );
		$parent = $product->save();
		$variants = array(
			array( '1 confezione', '49.90', '44.90', 100, 'NUT-COLL-500-1' ),
			array( '2 confezioni', '89.90', null, 50, 'NUT-COLL-500-2' ),
			array( '3 confezioni', '119.90', null, 30, 'NUT-COLL-500-3' ),
		);
		foreach ( $variants as $v ) {
			$variation = new WC_Product_Variation();
			$variation->set_parent_id( $parent );
			$variation->set_attributes( array( sanitize_title( 'Quantità' ) => $v[0] ) );
			$variation->set_regular_price( $v[1] );
			if ( $v[2] ) {
				$variation->set_sale_price( $v[2] );
			}
			$variation->set_manage_stock( true );
			$variation->set_stock_quantity( $v[3] );
			$variation->set_sku( $v[4] );
			$variation->set_weight( (string) ( 0.6 * (int) $v[0] ) );
			$variation->save();
		}
		WC_Product_Variable::sync( $parent );
		continue;
	}

	$product = new WC_Product_Simple();
	$product->set_name( $name );
	$product->set_slug( $slug );
	$product->set_sku( 'NUT-' . strtoupper( $slug ) );
	$product->set_regular_price( $price );
	if ( $sale ) {
		$product->set_sale_price( $sale );
	}
	$product->set_manage_stock( true );
	$product->set_stock_quantity( $stock );
	$product->set_short_description( $short );
	$product->set_description( '<p>' . $short . '</p><p>Prodotto di prova del WooCommerce locale.</p>' );
	$product->set_category_ids( array( $cats[ $form ] ) );
	$product->set_attributes( array( $attr ) );
	$product->set_menu_order( $i );
	$product->set_weight( '0.3' );
	if ( $image ) {
		$product->set_image_id( $image );
	}
	$product->save();
}

// un prodotto di un altro negozio sullo stesso WooCommerce: il negozio Nutrex non deve mostrarlo ne' venderlo
if ( ! wc_get_product_id_by_sku( 'ALTRO-001' ) ) {
	$other = new WC_Product_Simple();
	$other->set_name( 'Prodotto di un altro negozio' );
	$other->set_slug( 'prodotto-altro-negozio' );
	$other->set_sku( 'ALTRO-001' );
	$other->set_regular_price( '10.00' );
	$other->set_manage_stock( true );
	$other->set_stock_quantity( 10 );
	$other->set_category_ids( array( nutrex_dev_category( 'Altro negozio', 'altro-negozio' ) ) );
	$other->save();
}

// coupon di prova: 10%
if ( ! wc_get_coupon_id_by_code( 'PROVA10' ) ) {
	$coupon = new WC_Coupon();
	$coupon->set_code( 'PROVA10' );
	$coupon->set_discount_type( 'percent' );
	$coupon->set_amount( 10 );
	$coupon->save();
}

// password applicazione dell'amministratore per la REST API (in locale vale anche su http)
$admin = get_user_by( 'login', 'admin' );
$out   = array( 'url' => home_url(), 'user' => 'admin' );
if ( $admin && class_exists( 'WP_Application_Passwords' ) ) {
	list( $password ) = WP_Application_Passwords::create_new_application_password( $admin->ID, array( 'name' => 'negozio-locale-' . time() ) );
	$out['password'] = $password;
}
if ( is_dir( '/wp-out' ) ) {
	file_put_contents( '/wp-out/credentials.json', wp_json_encode( $out, JSON_PRETTY_PRINT ) );
}
flush_rewrite_rules();
echo "Negozio di prova pronto\n";
