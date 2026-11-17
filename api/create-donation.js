/**
 * Serverless Function para Vercel / Netlify
 * Rota: /api/create-donation
 */

export default async function handler(req, res) {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { donor, donation } = req.body;

    const MISTICPAY_PK = process.env.MISTICPAY_PUBLIC_KEY || '';
    const MISTICPAY_SK = process.env.MISTICPAY_SECRET_KEY || '';

    const authHeader = 'Basic ' + Buffer.from(`${MISTICPAY_PK}:${MISTICPAY_SK}`).toString('base64');

    const payload = {
      amount: Number(donation.totalAmount),
      payerName: donor.name,
      payerDocument: donor.cpf.replace(/\D/g, '')
    };

    const response = await fetch('https://api.misticpay.com/api/transactions/create', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || 'Erro retornado pela MisticPay'
      });
    }

    const copiaECola = data.qrCode || data.pixCode || data.copiaECola || data.emv || (data.data && (data.data.qrCode || data.data.pixCode || data.data.copiaECola));

    return res.status(200).json({
      success: true,
      id: data.id || (data.data && data.data.id),
      amount: donation.totalAmount,
      qrCodeText: copiaECola,
      copiaECola: copiaECola
    });

  } catch (error) {
    console.error('Erro na função serverless:', error);
    return res.status(500).json({ error: 'Falha ao processar doação com a MisticPay' });
  }
}
