<?php
/**
 * Recensioni dei prodotti Nutrex scritte su nutrexlab.it:
 *
 *   POST /wp-json/nutrex/v1/recensione  { product_id, nome, email, voto (1-5), testo }
 *
 * Diventano normali recensioni WooCommerce di questo sito, con le stesse regole del modulo di
 * WooCommerce (recensioni attive, voto obbligatorio, solo chi ha acquistato, moderazione dei
 * commenti, controllo dei duplicati): nutrexlab.it legge poi quelle approvate dalla Store API.
 * Solo per i prodotti Nutrex.
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'nutrex/v1',
			'/recensione',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => 'nutrex_headless_review_submit',
			)
		);
	}
);

function nutrex_headless_review_error( $code, $message, $status = 400 ) {
	return new WP_Error( 'nutrex_review_' . $code, $message, array( 'status' => $status ) );
}

function nutrex_headless_review_submit( WP_REST_Request $request ) {
	if ( 'yes' !== get_option( 'woocommerce_enable_reviews', 'yes' ) ) {
		return nutrex_headless_review_error( 'disabled', __( 'Le recensioni non sono attive.', 'nutrex-headless' ), 403 );
	}
	$product_id = absint( $request->get_param( 'product_id' ) );
	$product    = $product_id ? wc_get_product( $product_id ) : null;
	if ( ! $product || 'publish' !== $product->get_status() || ! nutrex_headless_is_product( $product_id ) ) {
		return nutrex_headless_review_error( 'product', __( 'Prodotto non trovato.', 'nutrex-headless' ), 404 );
	}
	if ( ! comments_open( $product_id ) ) {
		return nutrex_headless_review_error( 'closed', __( 'Questo prodotto non accetta recensioni.', 'nutrex-headless' ), 403 );
	}

	$nome  = sanitize_text_field( (string) $request->get_param( 'nome' ) );
	$email = sanitize_email( (string) $request->get_param( 'email' ) );
	$voto  = min( 5, absint( $request->get_param( 'voto' ) ) );
	$testo = trim( sanitize_textarea_field( (string) $request->get_param( 'testo' ) ) );
	if ( mb_strlen( $nome ) < 2 ) {
		return nutrex_headless_review_error( 'name', __( 'Inserisci il tuo nome.', 'nutrex-headless' ) );
	}
	if ( ! is_email( $email ) ) {
		return nutrex_headless_review_error( 'email', __( 'Inserisci un indirizzo email valido.', 'nutrex-headless' ) );
	}
	if ( mb_strlen( $testo ) < 5 ) {
		return nutrex_headless_review_error( 'text', __( 'Scrivi la tua recensione.', 'nutrex-headless' ) );
	}
	$rating_on = 'yes' === get_option( 'woocommerce_enable_review_rating', 'yes' );
	if ( $rating_on && ! $voto && 'yes' === get_option( 'woocommerce_review_rating_required', 'yes' ) ) {
		return nutrex_headless_review_error( 'rating', __( 'Scegli da 1 a 5 stelle.', 'nutrex-headless' ) );
	}
	if ( 'yes' === get_option( 'woocommerce_review_rating_verification_required', 'no' ) && ! wc_customer_bought_product( $email, 0, $product_id ) ) {
		return nutrex_headless_review_error( 'verified', __( 'Possono scrivere una recensione solo i clienti che hanno acquistato questo prodotto.', 'nutrex-headless' ), 403 );
	}

	// al massimo 3 recensioni l'ora per indirizzo
	$ip    = nutrex_headless_contact_ip( $request );
	$key   = 'nutrex_review_' . md5( $ip );
	$count = (int) get_transient( $key );
	if ( $count >= 3 ) {
		return nutrex_headless_review_error( 'limit', __( 'Hai inviato molte recensioni in poco tempo: riprova tra un po\'.', 'nutrex-headless' ), 429 );
	}
	set_transient( $key, $count + 1, HOUR_IN_SECONDS );

	// come il modulo di WooCommerce: il voto arriva in $_POST e lo salva WooCommerce stesso (con media e conteggi)
	if ( $rating_on && $voto ) {
		$_POST['rating']          = $voto;
		$_POST['comment_post_ID'] = $product_id;
	}
	$comment_id = wp_new_comment(
		array(
			'comment_post_ID'      => $product_id,
			'comment_author'       => $nome,
			'comment_author_email' => $email,
			'comment_author_url'   => '',
			'comment_content'      => $testo,
			'comment_type'         => 'review',
			'comment_parent'       => 0,
			'user_id'              => 0,
			'comment_author_IP'    => preg_replace( '/[^0-9a-fA-F:.]/', '', $ip ),
			'comment_agent'        => 'nutrexlab.it',
		),
		true
	);
	if ( is_wp_error( $comment_id ) ) {
		$known = array(
			'comment_duplicate' => __( 'Sembra che tu abbia già inviato questa recensione.', 'nutrex-headless' ),
			'comment_flood'     => __( 'Stai inviando recensioni troppo in fretta: riprova tra qualche minuto.', 'nutrex-headless' ),
		);
		return nutrex_headless_review_error( 'rejected', $known[ $comment_id->get_error_code() ] ?? __( 'Recensione non accettata.', 'nutrex-headless' ) );
	}
	$comment = get_comment( $comment_id );
	return array(
		'ok'       => true,
		'approved' => $comment && '1' === (string) $comment->comment_approved,
	);
}
