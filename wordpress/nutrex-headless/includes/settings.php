<?php
/**
 * Impostazioni: WooCommerce > Impostazioni > Avanzate > Nutrex Lab.
 */

defined( 'ABSPATH' ) || exit;

add_filter(
	'woocommerce_get_sections_advanced',
	function ( $sections ) {
		$sections['nutrex'] = __( 'Nutrex Lab', 'nutrex-headless' );
		return $sections;
	}
);

add_filter(
	'woocommerce_get_settings_advanced',
	function ( $settings, $section ) {
		if ( 'nutrex' !== $section ) {
			return $settings;
		}
		return array(
			array(
				'title' => __( 'Negozio Nutrex Lab', 'nutrex-headless' ),
				'type'  => 'title',
				'desc'  => __( 'Il negozio nutrexlab.it mostra i prodotti della categoria indicata qui sotto. Per pagare, i clienti arrivano al checkout di questo WooCommerce con gli stessi prodotti nel carrello; dopo il pagamento tornano su nutrexlab.it. Il resto del sito non cambia.', 'nutrex-headless' ),
				'id'    => 'nutrex_headless',
			),
			array(
				'title'       => __( 'Indirizzo del negozio', 'nutrex-headless' ),
				'id'          => 'nutrex_headless_frontend_url',
				'type'        => 'text',
				'placeholder' => 'https://nutrexlab.it',
				'desc_tip'    => __( 'Dopo il pagamento di un ordine Nutrex il cliente torna qui; i link dei prodotti Nutrex (anche nelle email) portano qui.', 'nutrex-headless' ),
			),
			array(
				'title'       => __( 'Categoria dei prodotti Nutrex', 'nutrex-headless' ),
				'id'          => 'nutrex_headless_category',
				'type'        => 'text',
				'placeholder' => 'nutrex-lab',
				'desc_tip'    => __( 'Lo slug della categoria (come WOOCOMMERCE_CATEGORY su Vercel). Vale anche per le sue sottocategorie.', 'nutrex-headless' ),
			),
			array(
				'title'       => __( 'Mittente delle email degli ordini Nutrex', 'nutrex-headless' ),
				'id'          => 'nutrex_headless_email_from_name',
				'type'        => 'text',
				'placeholder' => 'Nutrex Lab',
				'desc_tip'    => __( 'Vuoto: il mittente normale di WooCommerce.', 'nutrex-headless' ),
			),
			array(
				'title'    => __( 'Indirizzo mittente delle email degli ordini Nutrex', 'nutrex-headless' ),
				'id'       => 'nutrex_headless_email_from_address',
				'type'     => 'email',
				'desc_tip' => __( 'Es. ordini@nutrexlab.it: deve poter inviare dal server di posta del sito. Vuoto: quello normale.', 'nutrex-headless' ),
			),
			array(
				'type' => 'sectionend',
				'id'   => 'nutrex_headless',
			),
		);
	},
	10,
	2
);

add_filter(
	'plugin_action_links_' . plugin_basename( dirname( __DIR__ ) . '/nutrex-headless.php' ),
	function ( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=wc-settings&tab=advanced&section=nutrex' ) ) . '">' . esc_html__( 'Impostazioni', 'nutrex-headless' ) . '</a>' );
		return $links;
	}
);
