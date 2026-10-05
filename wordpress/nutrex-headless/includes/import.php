<?php
/**
 * Importazione dei prodotti da CSV (Prodotti > Importa) con la colonna "Slug": i prodotti Nutrex
 * prendono lo slug del negozio (es. "magnesio"), che lega ogni prodotto ai colori e al racconto 3D del
 * sito. WooCommerce da solo ricava lo slug dal nome. Senza la colonna non cambia nulla.
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'woocommerce_csv_product_import_mapping_options',
	function ( $options ) {
		$options['nutrex_slug'] = __( 'Slug', 'nutrex-headless' );
		return $options;
	}
);

// la colonna "Slug" del file si collega da sola; peso e misure in kg e cm anche se le unita' del
// negozio non sono mai state salvate (WooCommerce le userebbe per riconoscere le colonne)
add_filter(
	'woocommerce_csv_product_import_mapping_default_columns',
	function ( $columns ) {
		$columns['Slug'] = 'nutrex_slug';
		$columns['slug'] = 'nutrex_slug';
		if ( 'kg' === ( get_option( 'woocommerce_weight_unit' ) ?: 'kg' ) ) {
			$columns['Weight (kg)'] = 'weight';
		}
		if ( 'cm' === ( get_option( 'woocommerce_dimension_unit' ) ?: 'cm' ) ) {
			$columns['Length (cm)'] = 'length';
			$columns['Width (cm)']  = 'width';
			$columns['Height (cm)'] = 'height';
		}
		return $columns;
	},
	20
);

add_filter(
	'woocommerce_product_import_pre_insert_product_object',
	function ( $product, $data ) {
		$slug = isset( $data['nutrex_slug'] ) ? sanitize_title( $data['nutrex_slug'] ) : '';
		if ( $slug && $product instanceof WC_Product ) {
			$product->set_slug( $slug );
		}
		return $product;
	},
	10,
	2
);
