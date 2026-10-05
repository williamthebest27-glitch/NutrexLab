<?php
/**
 * SOLO SVILUPPO LOCALE (WordPress Playground, database SQLite, http): non installare in produzione.
 *
 * 1. La prenotazione dello stock durante il checkout di WooCommerce usa una query scritta per MySQL
 *    (INSERT ... FROM DUAL ... ON DUPLICATE KEY UPDATE) che con SQLite non funziona e fa rifiutare
 *    ogni ordine per "stock insufficiente". In produzione (MySQL) la prenotazione resta attiva.
 * 2. La REST API di WooCommerce accetta le chiavi API solo su HTTPS: qui il server locale e' http,
 *    quindi le richieste alla REST v3 vengono trattate come HTTPS (in produzione lo sono davvero).
 * 3. Crea una chiave API WooCommerce (Lettura/Scrittura) per il negozio locale e la scrive in
 *    /wp-out/woo-keys.json (cartella temporanea fuori dal repository).
 */

add_filter( 'woocommerce_hold_stock_for_checkout', '__return_false' );

if ( isset( $_SERVER['REQUEST_URI'] ) && false !== strpos( (string) $_SERVER['REQUEST_URI'], '/wp-json/wc/v3/' ) ) {
	$_SERVER['HTTPS'] = 'on';
	// il server locale non compila PHP_AUTH_USER/PW: li ricava dall'intestazione Authorization
	if ( empty( $_SERVER['PHP_AUTH_USER'] ) && ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) && 0 === stripos( $_SERVER['HTTP_AUTHORIZATION'], 'basic ' ) ) {
		$pair = explode( ':', (string) base64_decode( substr( $_SERVER['HTTP_AUTHORIZATION'], 6 ) ), 2 );
		if ( 2 === count( $pair ) ) {
			list( $_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW'] ) = $pair;
		}
	}
}

add_action(
	'init',
	function () {
		if ( ! function_exists( 'wc_api_hash' ) || get_option( 'nutrex_local_api_key' ) || ! is_dir( '/wp-out' ) ) {
			return;
		}
		global $wpdb;
		$admin = get_user_by( 'login', 'admin' );
		if ( ! $admin ) {
			return;
		}
		$key    = 'ck_' . wc_rand_hash();
		$secret = 'cs_' . wc_rand_hash();
		$wpdb->insert(
			$wpdb->prefix . 'woocommerce_api_keys',
			array(
				'user_id'         => $admin->ID,
				'description'     => 'Negozio locale (sviluppo)',
				'permissions'     => 'read_write',
				'consumer_key'    => wc_api_hash( $key ),
				'consumer_secret' => $secret,
				'truncated_key'   => substr( $key, -7 ),
			)
		);
		update_option( 'nutrex_local_api_key', 1 );
		file_put_contents( '/wp-out/woo-keys.json', wp_json_encode( array( 'url' => home_url(), 'key' => $key, 'secret' => $secret ), JSON_PRETTY_PRINT ) );
	}
);
