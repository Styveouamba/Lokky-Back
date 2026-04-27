import express, { Request, Response } from 'express';

const router = express.Router();

/**
 * Success redirect - Redirects to mobile app
 * GET /subscription/success?subscriptionId=xxx
 */
router.get('/success', (req: Request, res: Response) => {
  const { subscriptionId } = req.query;
  
  console.log('[Subscription] Payment success redirect:', subscriptionId);
  
  // Redirect to mobile app with deep link
  const deepLink = `lokky://subscription/success?subscriptionId=${subscriptionId}`;
  
  // Send HTML page that redirects to the app
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Paiement réussi</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          padding: 20px;
        }
        .container {
          max-width: 400px;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 28px;
          margin-bottom: 10px;
        }
        p {
          font-size: 16px;
          opacity: 0.9;
          margin-bottom: 30px;
        }
        .button {
          display: inline-block;
          background: white;
          color: #667eea;
          padding: 15px 30px;
          border-radius: 25px;
          text-decoration: none;
          font-weight: 600;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: scale(1.05);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🎉</div>
        <h1>Paiement réussi!</h1>
        <p>Votre abonnement Premium a été activé. Redirection vers l'application...</p>
        <a href="${deepLink}" class="button">Ouvrir Lokky</a>
      </div>
      <script>
        // Auto-redirect after 2 seconds
        setTimeout(() => {
          window.location.href = '${deepLink}';
        }, 2000);
      </script>
    </body>
    </html>
  `);
});

/**
 * Error redirect - Redirects to mobile app
 * GET /subscription/error?subscriptionId=xxx
 */
router.get('/error', (req: Request, res: Response) => {
  const { subscriptionId } = req.query;
  
  console.log('[Subscription] Payment error redirect:', subscriptionId);
  
  // Redirect to mobile app with deep link
  const deepLink = `lokky://subscription/error?subscriptionId=${subscriptionId}`;
  
  // Send HTML page that redirects to the app
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Paiement échoué</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          text-align: center;
          padding: 20px;
        }
        .container {
          max-width: 400px;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 28px;
          margin-bottom: 10px;
        }
        p {
          font-size: 16px;
          opacity: 0.9;
          margin-bottom: 30px;
        }
        .button {
          display: inline-block;
          background: white;
          color: #f5576c;
          padding: 15px 30px;
          border-radius: 25px;
          text-decoration: none;
          font-weight: 600;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: scale(1.05);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">❌</div>
        <h1>Paiement échoué</h1>
        <p>Une erreur s'est produite lors du paiement. Veuillez réessayer.</p>
        <a href="${deepLink}" class="button">Retour à Lokky</a>
      </div>
      <script>
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          window.location.href = '${deepLink}';
        }, 3000);
      </script>
    </body>
    </html>
  `);
});

export default router;
