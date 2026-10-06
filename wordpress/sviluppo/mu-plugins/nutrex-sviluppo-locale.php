<?php
/**
 * SOLO SVILUPPO LOCALE (WordPress Playground, database SQLite, http): non installare in produzione.
 *
 * 1. La prenotazione dello stock durante il checkout di WooCommerce usa una query scritta per MySQL
 *    (INSERT ... FROM DUAL ... ON DUPLICATE KEY UPDATE) che con SQLite non funziona e fa rifiutare
 *    ogni ordine per "stock insufficiente". In produzione (MySQL) la prenotazione resta attiva.
 * 2. La REST API (WooCommerce e WordPress) accetta chiavi e password per le applicazioni solo su HTTPS: qui e' http,
 *    quindi le richieste alla REST v3 vengono trattate come HTTPS (in produzione lo sono davvero).
 * 3. Crea una chiave API WooCommerce (Lettura/Scrittura) per il negozio locale e la scrive in
 *    /wp-out/woo-keys.json (cartella temporanea fuori dal repository).
 */

add_filter( 'woocommerce_hold_stock_for_checkout', '__return_false' );

if ( isset( $_SERVER['REQUEST_URI'] ) && preg_match( '#/wp-json/(wc/v3|wp/v2|nutrex-dev/v1)/#', (string) $_SERVER['REQUEST_URI'] ) ) {
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

/*
 * 4. Le email non partono: finiscono in /wp-out/mail/*.html (mittente, destinatario, oggetto, "Rispondi a"
 *    e come partirebbero, in testa), per controllarne contenuto e aspetto. Nessun server di posta, mai.
 */
add_filter(
	'pre_wp_mail',
	function ( $result, $atts ) {
		if ( ! is_dir( '/wp-out' ) ) {
			return $result;
		}
		if ( ! is_dir( '/wp-out/mail' ) ) {
			mkdir( '/wp-out/mail' );
		}
		$address = apply_filters( 'wp_mail_from', 'wordpress@localhost' );
		$from    = apply_filters( 'wp_mail_from_name', 'WordPress' ) . ' <' . $address . '>';
		// come partirebbe: dal server di posta di nutrexlab.it (email Nutrex, vedi includes/mail.php) o normale
		$smtp  = function_exists( 'nutrex_headless_smtp' ) ? nutrex_headless_smtp() : null;
		$nx    = $smtp && ( ! empty( $GLOBALS['nutrex_headless_mail'] ) || 0 === strcasecmp( $address, nutrex_headless_sender_address() ) );
		$via   = $nx ? 'SMTP ' . $smtp['host'] . ':' . $smtp['port'] . ' come ' . $smtp['user'] : 'mittente normale del sito';
		$reply = implode( ' ', preg_grep( '/^reply-to:/i', array_map( 'trim', is_array( $atts['headers'] ) ? $atts['headers'] : explode( "\n", (string) $atts['headers'] ) ) ) );
		$head  = sprintf( "<!-- da: %s | a: %s | oggetto: %s | invio: %s | %s -->\n", $from, implode( ', ', (array) $atts['to'] ), $atts['subject'], $via, $reply );
		file_put_contents( sprintf( '/wp-out/mail/%s-%s.html', gmdate( 'His' ) . substr( (string) microtime( true ), -4 ), sanitize_title( $atts['subject'] ) ), $head . $atts['message'] );
		return true;
	},
	10,
	2
);

/*
 * 5. Prova di un file CSV di prodotti con l'importatore di WooCommerce, con lo stesso abbinamento
 *    automatico delle colonne della pagina Prodotti > Importa:
 *    POST /wp-json/nutrex-dev/v1/import {"file": "/wp-out/prodotti.csv"} (con la password per le applicazioni)
 */
add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'nutrex-dev/v1',
			'/import',
			array(
				'methods'             => 'POST',
				'permission_callback' => function () {
					return current_user_can( 'manage_woocommerce' );
				},
				'callback'            => function ( WP_REST_Request $request ) {
					$file = (string) $request->get_param( 'file' );
					if ( 0 !== strpos( $file, '/wp-out/' ) || ! is_readable( $file ) ) {
						return new WP_Error( 'nutrex_dev_file', 'File non trovato in /wp-out', array( 'status' => 400 ) );
					}
					include_once WC_ABSPATH . 'includes/admin/importers/class-wc-product-csv-importer-controller.php';
					include_once WC_ABSPATH . 'includes/import/class-wc-product-csv-importer.php';
					$controller = new class() extends WC_Product_CSV_Importer_Controller {
						public function map( $headers ) {
							return $this->auto_map_columns( $headers );
						}
					};
					$headers  = WC_Product_CSV_Importer_Controller::get_importer( $file, array( 'lines' => 1, 'parse' => false ) )->get_raw_keys();
					$mapped   = array_values( $controller->map( $headers ) );
					$importer = WC_Product_CSV_Importer_Controller::get_importer(
						$file,
						array(
							'mapping' => array( 'from' => $headers, 'to' => $mapped ),
							'parse'   => true,
							'lines'   => -1,
						)
					);
					// tutto in una volta (la pagina di WooCommerce invece procede a gruppi di 20 secondi)
					add_filter( 'woocommerce_product_importer_default_time_limit', function () { return 1800; } );
					$result = $importer->import();
					return array(
						'mapping'  => array_combine( $headers, $mapped ),
						'imported' => $result['imported'],
						'failed'   => array_map( function ( $e ) { return $e->get_error_message(); }, $result['failed'] ),
						'skipped'  => count( $result['skipped'] ),
					);
				},
			)
		);
	}
);
