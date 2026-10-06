<?php
/**
 * Pagina di pagamento con l'aspetto di Nutrex Lab (vedi includes/checkout-look.php): checkout, "Ordine
 * ricevuto" e "Paga l'ordine" dei clienti del negozio Nutrex. Il contenuto e' quello di WooCommerce.
 */

defined( 'ABSPATH' ) || exit;

$nutrex_front = nutrex_headless_shop_url();
$nutrex_back  = 'checkout' === nutrex_headless_look()
	? array( $nutrex_front . '/carrello', __( 'Torna al carrello', 'nutrex-headless' ) )
	: array( $nutrex_front, __( 'Torna su Nutrex Lab', 'nutrex-headless' ) );
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="theme-color" content="#f1f0f3" />
	<title><?php echo esc_html( wp_get_document_title() ); ?></title>
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'nutrex-look' ); ?>>
<?php wp_body_open(); ?>
<header class="nx-top">
	<a class="nx-top__logo" href="<?php echo esc_url( $nutrex_front ); ?>">
		<img src="<?php echo esc_url( nutrex_headless_asset( 'nutrex-logo.svg' ) ); ?>" alt="Nutrex Lab" width="140" height="36" />
	</a>
	<p class="nx-top__safe">
		<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.4" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
		<?php esc_html_e( 'Pagamento sicuro', 'nutrex-headless' ); ?>
	</p>
</header>
<main class="nx-main" id="main">
	<h1 class="nx-title"><?php echo esc_html( nutrex_headless_look_title() ); ?><span class="nx-title__dot" aria-hidden="true"></span></h1>
	<?php
	while ( have_posts() ) {
		the_post();
		the_content();
	}
	?>
</main>
<footer class="nx-foot">
	<a href="<?php echo esc_url( $nutrex_back[0] ); ?>">&larr; <?php echo esc_html( $nutrex_back[1] ); ?></a>
	<span>Nutrex Lab</span>
</footer>
<?php wp_footer(); ?>
</body>
</html>
