# Implementation Tasks: Lokky Premium Subscription - Phase 1

## Phase 1: Core Subscription System

This phase establishes the foundation for the premium subscription system, including payment processing, subscription management, and premium access control.

---

## 1. Database Models and Schema

### 1.1 Create Subscription Model

- [ ] Create `src/models/Subscription.ts` with ISubscription interface
- [ ] Define schema fields: userId, plan, status, startDate, endDate, trialEndDate, autoRenew, paymentMethod, amount, currency, nabooTransactionId, nabooCustomerId, cancelledAt, cancellationReason, timestamps
- [ ] Add validation rules: plan enum (monthly, annual), status enum (pending, trial, active, expired, cancelled), amount positive, endDate after startDate
- [ ] Create indexes: userId, status, endDate, compound index on {userId: 1, status: 1}
- [ ] Add pre-save hooks for date validation
- [ ] Export Subscription model

### 1.2 Create Transaction Model

- [ ] Create `src/models/Transaction.ts` with ITransaction interface
- [ ] Define schema fields: userId, subscriptionId, nabooTransactionId, amount, currency, paymentMethod, status, nabooStatus, nabooResponse, webhookReceived, webhookReceivedAt, failureReason, metadata, timestamps
- [ ] Add validation rules: nabooTransactionId unique, amount positive, status enum (pending, completed, failed, refunded)
- [ ] Create indexes: nabooTransactionId (unique), userId, subscriptionId, status
- [ ] Export Transaction model

### 1.3 Update User Model with Premium Fields

- [ ] Open `src/models/User.ts`
- [ ] Add premium object field with nested fields: isActive (Boolean), plan (String), since (Date), expiresAt (Date)
- [ ] Set default values: isActive false, plan null, since null, expiresAt null
- [ ] Add index on premium.isActive for performance
- [ ] Create migration script to add premium fields to existing users

---

## 2. NabooPay Integration

### 2.1 Create NabooPay Service

- [ ] Create `src/services/nabooPayService.ts`
- [ ] Add environment variables: NABOO_API_KEY, NABOO_WEBHOOK_SECRET, NABOO_API_URL, NABOO_SANDBOX_MODE
- [ ] Implement `initializePayment()` function to call NabooPay API v2 /payments/initialize endpoint
- [ ] Implement request payload builder with amount, currency, payment_method, customer details, return_url, cancel_url, webhook_url, metadata
- [ ] Add error handling for API failures with retry logic
- [ ] Implement response parser to extract payment_url and transaction_id
- [ ] Add logging for all NabooPay API calls
- [ ] Export service functions

### 2.2 Implement Webhook Signature Verification

- [ ] Create `src/utils/webhookVerification.ts`
- [ ] Implement `verifyWebhookSignature()` function using crypto.createHmac with SHA256
- [ ] Accept payload string and signature header as parameters
- [ ] Compare computed signature with provided signature using timing-safe comparison
- [ ] Return boolean indicating validity
- [ ] Add logging for signature verification attempts
- [ ] Export verification function

---

## 3. Subscription Controller

### 3.1 Create Subscription Controller

- [ ] Create `src/controllers/subscriptionController.ts`
- [ ] Import required models: Subscription, Transaction, User
- [ ] Import nabooPayService
- [ ] Add authentication middleware requirement for all endpoints

### 3.2 Implement Initiate Purchase Endpoint

- [ ] Create `initiatePurchase()` controller function
- [ ] Validate request body: plan (monthly/annual), paymentMethod (wave/orange_money/visa)
- [ ] Check for existing active/trial subscription for user
- [ ] Calculate pricing: monthly 2500 XOF, annual 20000 XOF
- [ ] Calculate dates: startDate (now), endDate (start + 30/365 days), trialEndDate (start + 7 days)
- [ ] Create pending subscription record in database
- [ ] Call nabooPayService.initializePayment() with subscription details
- [ ] Create pending transaction record with NabooPay transaction ID
- [ ] Update subscription with nabooTransactionId
- [ ] Return response with paymentUrl, transactionId, subscriptionId
- [ ] Add error handling for validation failures, duplicate subscriptions, NabooPay failures

### 3.3 Implement Get Subscription Status Endpoint

- [ ] Create `getSubscriptionStatus()` controller function
- [ ] Query subscription by userId with status in [trial, active]
- [ ] Determine isPremium flag based on subscription existence and status
- [ ] Build features list based on premium status
- [ ] Calculate trial days remaining if in trial period
- [ ] Return response with subscription object, isPremium, features, trial info
- [ ] Handle case where user has no subscription

### 3.4 Implement Cancel Subscription Endpoint

- [ ] Create `cancelSubscription()` controller function
- [ ] Query active subscription for user
- [ ] Validate subscription exists and is active/trial
- [ ] Set autoRenew to false
- [ ] Record cancelledAt timestamp
- [ ] Store optional cancellation reason from request body
- [ ] Save subscription
- [ ] Send push notification confirming cancellation
- [ ] Return response with updated subscription
- [ ] Add error handling for no active subscription

### 3.5 Implement Get Subscription History Endpoint

- [ ] Create `getSubscriptionHistory()` controller function
- [ ] Parse pagination parameters: page (default 1), limit (default 20, max 20)
- [ ] Query transactions by userId with pagination
- [ ] Sort by createdAt descending
- [ ] Populate subscription details for each transaction
- [ ] Calculate pagination metadata: total, pages, currentPage, hasNext, hasPrev
- [ ] Return response with transactions array and pagination object
- [ ] Add error handling for invalid pagination parameters

---

## 4. Webhook Handler

### 4.1 Create Webhook Controller

- [ ] Create `src/controllers/webhookController.ts`
- [ ] Import models: Transaction, Subscription, User
- [ ] Import webhookVerification utility
- [ ] Import push notification service

### 4.2 Implement NabooPay Webhook Handler

- [ ] Create `handleNabooPayment()` controller function
- [ ] Extract signature from request headers (X-Naboo-Signature or similar)
- [ ] Get raw request body as string for signature verification
- [ ] Call verifyWebhookSignature() with payload and signature
- [ ] If signature invalid, log security event and return 401 Unauthorized
- [ ] Parse webhook payload to extract transaction_id, status, amount, currency, metadata
- [ ] Query transaction by nabooTransactionId
- [ ] If transaction not found, log error and return 404
- [ ] Check if webhook already processed (webhookReceived flag)
- [ ] If already processed, return 200 OK immediately (idempotency)
- [ ] Update transaction: status, nabooStatus, nabooResponse, webhookReceived, webhookReceivedAt
- [ ] If payment failed, update transaction with failureReason and set subscription to expired
- [ ] If payment succeeded, activate subscription (set status to trial, update dates)
- [ ] Update user premium fields: isActive true, plan, since, expiresAt
- [ ] Invalidate Redis cache for user premium status
- [ ] Send push notification to user (success or failure)
- [ ] Return 200 OK response
- [ ] Add comprehensive error handling and logging

---

## 5. Premium Middleware

### 5.1 Create Premium Middleware

- [ ] Create `src/middleware/premiumMiddleware.ts`
- [ ] Import Subscription model and Redis client
- [ ] Define cache key format: `premium:${userId}`
- [ ] Define cache TTL: 5 minutes (300 seconds)

### 5.2 Implement Premium Status Check Function

- [ ] Create `checkPremiumStatus()` helper function
- [ ] Accept userId as parameter
- [ ] Try to get premium status from Redis cache
- [ ] If cache hit, parse JSON and return cached status
- [ ] If cache miss or Redis error, query Subscription model
- [ ] Find subscription with userId and status in [trial, active]
- [ ] Determine isPremium based on query result
- [ ] Build status object: {isPremium, plan, expiresAt}
- [ ] Cache status in Redis with TTL
- [ ] Return status object
- [ ] Handle Redis connection failures gracefully (fallback to database)

### 5.3 Implement Require Premium Middleware

- [ ] Create `requirePremium()` middleware function
- [ ] Extract userId from authenticated request (req.user.id)
- [ ] Call checkPremiumStatus(userId)
- [ ] If isPremium is false, return 403 Forbidden with error message
- [ ] If isPremium is true, call next() to continue
- [ ] Add error handling for database/Redis failures
- [ ] Export middleware function

### 5.4 Implement Cache Invalidation Function

- [ ] Create `invalidatePremiumCache()` helper function
- [ ] Accept userId as parameter
- [ ] Delete Redis key `premium:${userId}`
- [ ] Log cache invalidation
- [ ] Handle Redis errors gracefully
- [ ] Export function for use in subscription updates

---

## 6. API Routes

### 6.1 Create Subscription Routes

- [ ] Create `src/routes/subscriptionRoutes.ts`
- [ ] Import express Router
- [ ] Import subscriptionController functions
- [ ] Import authentication middleware
- [ ] Define POST /api/subscriptions/initiate route with auth middleware
- [ ] Define GET /api/subscriptions/status route with auth middleware
- [ ] Define POST /api/subscriptions/cancel route with auth middleware
- [ ] Define GET /api/subscriptions/history route with auth middleware
- [ ] Export router

### 6.2 Create Webhook Routes

- [ ] Create `src/routes/webhookRoutes.ts`
- [ ] Import express Router
- [ ] Import webhookController
- [ ] Define POST /api/webhooks/naboo-payment route (no auth, signature verification instead)
- [ ] Add express.raw() middleware for webhook route to preserve raw body
- [ ] Export router

### 6.3 Register Routes in Main App

- [ ] Open `src/app.ts` or `src/index.ts`
- [ ] Import subscriptionRoutes and webhookRoutes
- [ ] Register routes: app.use('/api/subscriptions', subscriptionRoutes)
- [ ] Register routes: app.use('/api/webhooks', webhookRoutes)
- [ ] Ensure webhook routes are registered before body parser middleware

---

## 7. Redis Caching Setup

### 7.1 Configure Redis Client

- [ ] Verify Redis client is configured in `src/config/redis.ts` or similar
- [ ] Add Redis connection URL to environment variables if not present
- [ ] Test Redis connection on app startup
- [ ] Add error handling for Redis connection failures
- [ ] Export Redis client for use in premium middleware

### 7.2 Implement Cache Helper Functions

- [ ] Create `src/utils/cacheHelpers.ts`
- [ ] Implement `setCache(key, value, ttl)` function
- [ ] Implement `getCache(key)` function
- [ ] Implement `deleteCache(key)` function
- [ ] Add error handling and logging
- [ ] Export functions

---

## 8. Premium Badge Integration

### 8.1 Update User API Responses

- [ ] Open user controller or serializer
- [ ] Add premium badge field to user response objects
- [ ] Set badge to true if user.premium.isActive is true
- [ ] Ensure badge field is included in profile endpoints
- [ ] Test with premium and non-premium users

### 8.2 Update Activity API Responses

- [ ] Open activity controller or serializer
- [ ] Populate activity creator (user) when returning activities
- [ ] Add premium badge field to activity response based on creator.premium.isActive
- [ ] Ensure badge field is included in activity list and detail endpoints
- [ ] Test with activities from premium and non-premium users

---

## 9. Push Notifications

### 9.1 Create Subscription Notification Templates

- [ ] Open push notification service or create `src/services/notificationService.ts`
- [ ] Define notification template for subscription activation: "Bienvenue dans Lokky Premium! 🎉"
- [ ] Define notification template for payment failure: "Échec du paiement"
- [ ] Define notification template for cancellation: "Abonnement annulé"
- [ ] Add function to send subscription notifications with user push token and template

### 9.2 Integrate Notifications in Subscription Flow

- [ ] In webhook handler, call notification service after subscription activation
- [ ] In webhook handler, call notification service after payment failure
- [ ] In cancel controller, call notification service after cancellation
- [ ] Add error handling for notification failures (don't block main flow)
- [ ] Log all notification attempts

---

## 10. Environment Configuration

### 10.1 Add Environment Variables

- [ ] Open `.env.example` file
- [ ] Add NABOO_API_KEY with placeholder
- [ ] Add NABOO_WEBHOOK_SECRET with placeholder
- [ ] Add NABOO_API_URL with default https://api.naboopay.com
- [ ] Add NABOO_SANDBOX_MODE with default true
- [ ] Add PREMIUM_MONTHLY_PRICE with default 2500
- [ ] Add PREMIUM_ANNUAL_PRICE with default 20000
- [ ] Add PREMIUM_CURRENCY with default XOF
- [ ] Add PREMIUM_TRIAL_DAYS with default 7
- [ ] Document each variable with comments

### 10.2 Update Environment Validation

- [ ] Open environment validation file (if exists)
- [ ] Add validation for required NabooPay variables
- [ ] Add validation for premium pricing variables
- [ ] Ensure app fails to start if required variables are missing

---

## 11. Database Migrations

### 11.1 Create User Premium Fields Migration

- [ ] Create migration script `migrations/add-premium-fields-to-users.js`
- [ ] Connect to MongoDB
- [ ] Update all existing users with premium object: {isActive: false, plan: null, since: null, expiresAt: null}
- [ ] Create index on premium.isActive
- [ ] Log migration progress
- [ ] Add rollback function to remove premium fields

### 11.2 Create Database Indexes

- [ ] Create migration script `migrations/create-subscription-indexes.js`
- [ ] Create indexes on Subscription collection: userId, status, endDate, {userId: 1, status: 1}
- [ ] Create indexes on Transaction collection: nabooTransactionId (unique), userId, subscriptionId, status
- [ ] Log index creation
- [ ] Add rollback function to drop indexes

---

## 12. Testing

### 12.1 Unit Tests for Subscription Controller

- [ ] Create `tests/unit/subscriptionController.test.ts`
- [ ] Test initiatePurchase with valid data
- [ ] Test initiatePurchase with existing active subscription (should fail)
- [ ] Test initiatePurchase with invalid plan
- [ ] Test getSubscriptionStatus for premium user
- [ ] Test getSubscriptionStatus for non-premium user
- [ ] Test cancelSubscription for active subscription
- [ ] Test cancelSubscription for non-existent subscription
- [ ] Test getSubscriptionHistory with pagination
- [ ] Mock database and NabooPay service

### 12.2 Unit Tests for Webhook Handler

- [ ] Create `tests/unit/webhookController.test.ts`
- [ ] Test webhook with valid signature
- [ ] Test webhook with invalid signature (should return 401)
- [ ] Test webhook for successful payment
- [ ] Test webhook for failed payment
- [ ] Test webhook idempotency (duplicate webhook)
- [ ] Test webhook for non-existent transaction
- [ ] Mock database, signature verification, and notifications

### 12.3 Unit Tests for Premium Middleware

- [ ] Create `tests/unit/premiumMiddleware.test.ts`
- [ ] Test requirePremium with active subscription (should allow)
- [ ] Test requirePremium with trial subscription (should allow)
- [ ] Test requirePremium with expired subscription (should deny)
- [ ] Test requirePremium with no subscription (should deny)
- [ ] Test cache hit scenario
- [ ] Test cache miss scenario
- [ ] Test Redis failure fallback
- [ ] Mock database and Redis

### 12.4 Property-Based Tests

- [ ] Create `tests/property/subscriptionProperties.test.ts`
- [ ] Install fast-check: `npm install --save-dev fast-check`
- [ ] Property test: Subscription end date calculation (Property 1)
- [ ] Property test: Webhook idempotency (Property 4)
- [ ] Property test: Premium access control (Property 6)
- [ ] Property test: Date validation (Property 1)
- [ ] Property test: Pricing validation (Property 16)
- [ ] Run 100+ iterations per property test
- [ ] Tag tests with feature name and property numbers

### 12.5 Integration Tests

- [ ] Create `tests/integration/subscriptionFlow.test.ts`
- [ ] Test complete subscription purchase flow with NabooPay sandbox
- [ ] Test webhook delivery and processing
- [ ] Test subscription activation and premium access
- [ ] Test subscription cancellation flow
- [ ] Use test database and Redis instance
- [ ] Clean up test data after each test

---

## 13. Frontend Implementation

### 13.1 Create Subscription Selection Screen

- [ ] Create `screens/SubscriptionScreen.tsx`
- [ ] Display monthly plan card: 2,500 FCFA/month
- [ ] Display annual plan card: 20,000 FCFA/year (highlight savings)
- [ ] Add plan selection state
- [ ] Add payment method selector: Wave, Orange Money, Visa
- [ ] Add "Subscribe" button
- [ ] Implement loading state during payment initialization
- [ ] Add error handling and display

### 13.2 Implement Payment Flow

- [ ] Create `components/PaymentWebView.tsx`
- [ ] Use react-native-webview to display NabooPay payment URL
- [ ] Handle payment completion redirect (return_url)
- [ ] Handle payment cancellation redirect (cancel_url)
- [ ] Poll subscription status after payment completion
- [ ] Navigate to success screen when subscription activated
- [ ] Add loading indicator during status polling

### 13.3 Create Subscription Status Screen

- [ ] Create `screens/SubscriptionStatusScreen.tsx`
- [ ] Fetch and display current subscription status
- [ ] Show plan type, start date, end date
- [ ] Show trial status and days remaining if applicable
- [ ] Display auto-renewal status
- [ ] Add "Cancel Subscription" button for active subscriptions
- [ ] Add "Upgrade to Premium" button for non-premium users
- [ ] Implement pull-to-refresh

### 13.4 Create Subscription Management Screen

- [ ] Create `screens/ManageSubscriptionScreen.tsx`
- [ ] Display subscription details
- [ ] Add cancel subscription functionality with confirmation dialog
- [ ] Add optional cancellation reason input
- [ ] Display transaction history with pagination
- [ ] Show transaction details: date, amount, status, payment method
- [ ] Add "View Receipt" option for completed transactions

### 13.5 Implement Premium Badge UI Component

- [ ] Create `components/PremiumBadge.tsx`
- [ ] Design badge icon (crown or star)
- [ ] Add badge styling with gradient or gold color
- [ ] Make badge reusable for profiles and activities
- [ ] Add tooltip or label "Premium"

### 13.6 Integrate Premium Badge in User Profiles

- [ ] Open user profile component
- [ ] Add PremiumBadge component next to username
- [ ] Show badge only if user.premium.isActive is true
- [ ] Test with premium and non-premium users

### 13.7 Integrate Premium Badge in Activity Cards

- [ ] Open activity card component
- [ ] Add PremiumBadge component next to activity creator name
- [ ] Show badge only if activity.createdBy.premium.isActive is true
- [ ] Test with activities from premium and non-premium users

### 13.8 Create API Service Functions

- [ ] Create `services/subscriptionService.ts`
- [ ] Implement `initiatePurchase(plan, paymentMethod)` API call
- [ ] Implement `getSubscriptionStatus()` API call
- [ ] Implement `cancelSubscription(reason)` API call
- [ ] Implement `getSubscriptionHistory(page, limit)` API call
- [ ] Add error handling and response parsing
- [ ] Export service functions

### 13.9 Add Subscription State Management

- [ ] Create subscription store using Zustand or Context API
- [ ] Add state: currentSubscription, isPremium, loading, error
- [ ] Add actions: fetchStatus, initiatePurchase, cancelSubscription, fetchHistory
- [ ] Persist isPremium flag for quick access
- [ ] Invalidate cache on subscription changes

### 13.10 Add Navigation

- [ ] Add "Premium" tab or menu item in main navigation
- [ ] Link to SubscriptionScreen for non-premium users
- [ ] Link to SubscriptionStatusScreen for premium users
- [ ] Add deep linking for payment return URLs
- [ ] Test navigation flow

---

## 14. Documentation

### 14.1 API Documentation

- [ ] Create or update `docs/api/subscriptions.md`
- [ ] Document POST /api/subscriptions/initiate endpoint
- [ ] Document GET /api/subscriptions/status endpoint
- [ ] Document POST /api/subscriptions/cancel endpoint
- [ ] Document GET /api/subscriptions/history endpoint
- [ ] Document POST /api/webhooks/naboo-payment endpoint
- [ ] Include request/response examples
- [ ] Document error codes and messages

### 14.2 Setup Documentation

- [ ] Create `docs/setup/premium-subscription.md`
- [ ] Document NabooPay account setup
- [ ] Document environment variable configuration
- [ ] Document database migration steps
- [ ] Document Redis setup requirements
- [ ] Document testing with NabooPay sandbox

### 14.3 User Guide

- [ ] Create `docs/user-guide/premium-features.md`
- [ ] Document how to subscribe to premium
- [ ] Document payment methods and pricing
- [ ] Document trial period details
- [ ] Document how to cancel subscription
- [ ] Document premium features overview
- [ ] Add screenshots of subscription screens

---

## 15. Deployment Preparation

### 15.1 Environment Setup

- [ ] Add NabooPay production API key to production environment
- [ ] Add NabooPay webhook secret to production environment
- [ ] Set NABOO_SANDBOX_MODE to false in production
- [ ] Verify Redis is available in production
- [ ] Verify MongoDB indexes are created in production

### 15.2 Monitoring and Logging

- [ ] Add logging for all subscription events
- [ ] Add logging for all payment events
- [ ] Add logging for webhook deliveries
- [ ] Set up alerts for payment failures
- [ ] Set up alerts for webhook signature failures
- [ ] Monitor subscription conversion rates

### 15.3 Security Review

- [ ] Review webhook signature verification implementation
- [ ] Review API authentication on subscription endpoints
- [ ] Review sensitive data handling (payment info)
- [ ] Review rate limiting on subscription endpoints
- [ ] Review input validation on all endpoints
- [ ] Test with security scanning tools

---

## Phase 1 Completion Checklist

- [ ] All database models created and tested
- [ ] NabooPay integration working in sandbox
- [ ] Subscription purchase flow complete
- [ ] Webhook handler processing payments correctly
- [ ] Premium middleware enforcing access control
- [ ] Redis caching implemented and tested
- [ ] Premium badges displaying correctly
- [ ] Push notifications sending successfully
- [ ] All unit tests passing (80%+ coverage)
- [ ] Property-based tests passing (100+ iterations)
- [ ] Integration tests passing
- [ ] Frontend screens implemented and functional
- [ ] API documentation complete
- [ ] Deployment preparation complete
- [ ] Security review passed

---

## Notes

- Estimated time: 2 weeks (10 working days)
- Dependencies: NabooPay sandbox account, Redis instance, MongoDB
- Team: 2 backend developers, 1 frontend developer
- Testing: Continuous testing throughout development
- Code review: Required before merging each major component

