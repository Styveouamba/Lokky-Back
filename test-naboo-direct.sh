#!/bin/bash

# Test direct de l'API NabooPay
curl -X POST https://api.naboopay.com/api/v2/transactions \
  -H "Authorization: Bearer pk_live_naboo_Mn1TbHQBRzemTx1vKOk9uBMgA-FBktIWngur9zjvNs8=" \
  -H "Content-Type: application/json" \
  -d '{
    "method_of_payment": ["wave"],
    "products": [
      {
        "name": "Test Product",
        "price": 100,
        "quantity": 1
      }
    ],
    "success_url": "https://example.com/success",
    "error_url": "https://example.com/error",
    "fees_customer_side": false,
    "is_escrow": false
  }'
