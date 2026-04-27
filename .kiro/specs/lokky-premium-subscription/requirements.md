# Requirements Document: Lokky Premium Subscription

## Introduction

This requirements document specifies the functional and non-functional requirements for the Lokky Premium Subscription system. The system enables users to purchase premium subscriptions through NabooPay (supporting Wave, Orange Money, and Visa), unlocking premium features including activity boosting, photo galleries, profile view tracking, recurring activities, and premium badges. This document focuses on Phase 1: Core Subscription System, which establishes the foundation for all premium features.

## Glossary

- **System**: The Lokky Premium Subscription backend API and frontend application
- **User**: A registered Lokky user who may purchase a premium subscription
- **Premium_User**: A user with an active premium subscription (trial or paid)
- **Subscription**: A time-bound premium access record with payment details
- **Transaction**: A payment record linked to a subscription purchase or renewal
- **NabooPay**: Third-party payment gateway supporting West African payment methods
- **Webhook**: HTTP callback from NabooPay confirming payment status
- **Trial_Period**: 7-day free premium access period for new subscribers
- **Premium_Middleware**: Authorization layer validating premium access
- **Premium_Badge**: Visual indicator displayed on premium user profiles and activities
- **Redis_Cache**: In-memory data store for premium status caching

## Requirements

### Requirement 1: Subscription Purchase Initiation

**User Story:** As a user, I want to purchase a premium subscription, so that I can access premium features in the Lokky app.

#### Acceptance Criteria

1. WHEN a user selects a subscription plan (monthly or annual), THE System SHALL create a pending subscription record in the database
2. WHEN a user selects a payment method (Wave, Orange Money, or Visa), THE System SHALL initialize a payment transaction with NabooPay
3. WHEN NabooPay returns a payment URL, THE System SHALL provide the URL to the user for payment completion
4. WHEN a user already has an active or trial subscription, THE System SHALL reject the purchase request with an appropriate error message
5. THE System SHALL calculate the subscription end date as 30 days for monthly plans and 365 days for annual plans from the start date
6. THE System SHALL set the trial end date as 7 days from the subscription start date for new subscriptions
7. THE System SHALL store the NabooPay transaction ID with the subscription record for tracking

### Requirement 2: Payment Webhook Processing

**User Story:** As the system, I want to receive payment confirmations from NabooPay, so that I can activate user subscriptions automatically.

#### Acceptance Criteria

1. WHEN a webhook is received from NabooPay, THE System SHALL verify the webhook signature using HMAC-SHA256
2. IF the webhook signature is invalid, THEN THE System SHALL reject the webhook with a 401 Unauthorized response and log a security event
3. WHEN a webhook with a valid signature is received, THE System SHALL locate the transaction using the NabooPay transaction ID
4. WHEN a payment succeeds, THE System SHALL update the transaction status to completed and the subscription status to trial
5. WHEN a payment fails, THE System SHALL update the transaction status to failed and the subscription status to expired
6. WHEN a webhook is received for an already-processed transaction, THE System SHALL return 200 OK without reprocessing (idempotency)
7. THE System SHALL record the webhook received timestamp and payload for audit purposes
8. WHEN a subscription is activated, THE System SHALL update the user premium flag to active

### Requirement 3: Premium Status Validation

**User Story:** As the system, I want to validate premium access for protected features, so that only premium users can access premium functionality.

#### Acceptance Criteria

1. WHEN a user accesses a premium-protected endpoint, THE Premium_Middleware SHALL verify the user has an active subscription
2. WHEN a user has a subscription with status trial or active, THE Premium_Middleware SHALL grant access to premium features
3. WHEN a user has a subscription with status expired or cancelled, THE Premium_Middleware SHALL deny access with a 403 Forbidden response
4. WHEN a user has no subscription record, THE Premium_Middleware SHALL deny access with a 403 Forbidden response
5. THE Premium_Middleware SHALL cache premium status in Redis with a 5-minute TTL to reduce database queries
6. WHEN a subscription status changes, THE System SHALL invalidate the Redis cache for that user
7. THE Premium_Middleware SHALL return a clear error message indicating premium access is required

### Requirement 4: Subscription Status Retrieval

**User Story:** As a user, I want to view my current subscription status, so that I can see my plan details and expiration date.

#### Acceptance Criteria

1. WHEN a user requests their subscription status, THE System SHALL return the current subscription record with plan, status, and dates
2. WHEN a user has an active or trial subscription, THE System SHALL return isPremium as true
3. WHEN a user has no subscription or an expired subscription, THE System SHALL return isPremium as false
4. THE System SHALL return the list of available premium features based on subscription status
5. WHEN a user is in trial period, THE System SHALL return the trial end date and days remaining
6. THE System SHALL return the subscription auto-renewal status

### Requirement 5: Subscription Cancellation

**User Story:** As a premium user, I want to cancel my subscription, so that I can stop automatic renewals while retaining access until the end date.

#### Acceptance Criteria

1. WHEN a premium user requests subscription cancellation, THE System SHALL set the autoRenew flag to false
2. WHEN a subscription is cancelled, THE System SHALL record the cancellation timestamp and optional reason
3. WHEN a subscription is cancelled, THE System SHALL maintain the subscription status as active until the end date
4. THE System SHALL allow users to provide an optional cancellation reason for feedback
5. WHEN a cancelled subscription reaches its end date, THE System SHALL update the status to expired
6. THE System SHALL send a confirmation notification to the user after successful cancellation

### Requirement 6: Transaction History

**User Story:** As a user, I want to view my payment history, so that I can track my subscription purchases and renewals.

#### Acceptance Criteria

1. WHEN a user requests transaction history, THE System SHALL return all transactions associated with their user ID
2. THE System SHALL return transactions with amount, currency, payment method, status, and timestamp
3. THE System SHALL support pagination with a maximum of 20 transactions per page
4. THE System SHALL order transactions by creation date in descending order (newest first)
5. THE System SHALL include metadata indicating whether each transaction was a renewal or initial purchase
6. THE System SHALL include the subscription plan associated with each transaction

### Requirement 7: Premium Badge Display

**User Story:** As a user, I want to see premium badges on user profiles and activities, so that I can identify premium members.

#### Acceptance Criteria

1. WHEN a user profile is displayed, THE System SHALL include a premium badge indicator if the user has an active subscription
2. WHEN an activity is displayed, THE System SHALL include a premium badge indicator if the creator has an active subscription
3. THE System SHALL add the premium badge field to user API responses when the user is premium
4. THE System SHALL add the premium badge field to activity API responses when the creator is premium
5. THE System SHALL update badge visibility immediately when a subscription is activated or expires

### Requirement 8: User Model Premium Fields

**User Story:** As the system, I want to store premium status in the user model, so that I can quickly check premium access without querying subscriptions.

#### Acceptance Criteria

1. THE System SHALL add a premium object to the User model containing isActive, plan, since, and expiresAt fields
2. WHEN a subscription is activated, THE System SHALL set premium.isActive to true and premium.since to the current date
3. WHEN a subscription expires, THE System SHALL set premium.isActive to false
4. THE System SHALL update premium.plan with the subscription plan type (monthly or annual)
5. THE System SHALL update premium.expiresAt with the subscription end date
6. THE System SHALL ensure the premium fields are synchronized with the subscription status

### Requirement 9: Redis Caching for Premium Status

**User Story:** As the system, I want to cache premium status in Redis, so that I can reduce database load for frequent premium checks.

#### Acceptance Criteria

1. WHEN premium status is checked, THE System SHALL first query the Redis cache using key format premium:userId
2. WHEN the cache contains valid premium status, THE System SHALL return the cached value without querying the database
3. WHEN the cache does not contain premium status, THE System SHALL query the database and cache the result with a 5-minute TTL
4. WHEN a subscription status changes, THE System SHALL delete the Redis cache entry for that user
5. THE System SHALL store premium status in Redis as a JSON object containing isPremium, plan, and expiresAt
6. THE System SHALL handle Redis connection failures gracefully by falling back to database queries

### Requirement 10: Payment Method Support

**User Story:** As a user, I want to pay using my preferred payment method, so that I can complete my subscription purchase conveniently.

#### Acceptance Criteria

1. THE System SHALL support Wave as a payment method through NabooPay
2. THE System SHALL support Orange Money as a payment method through NabooPay
3. THE System SHALL support Visa as a payment method through NabooPay
4. WHEN a user selects a payment method, THE System SHALL pass the payment method to NabooPay during initialization
5. THE System SHALL store the selected payment method with the subscription record
6. THE System SHALL validate that the payment method is one of the supported options before processing

### Requirement 11: Subscription Pricing

**User Story:** As a user, I want to see clear pricing for subscription plans, so that I can choose the plan that fits my budget.

#### Acceptance Criteria

1. THE System SHALL price monthly subscriptions at 2,500 XOF (West African CFA Franc)
2. THE System SHALL price annual subscriptions at 20,000 XOF (West African CFA Franc)
3. THE System SHALL validate that the payment amount matches the selected plan pricing
4. THE System SHALL use XOF as the default currency for all transactions
5. THE System SHALL reject transactions with amounts that do not match the plan pricing
6. THE System SHALL display pricing in the user's local currency format in the frontend

### Requirement 12: Push Notifications for Subscription Events

**User Story:** As a user, I want to receive notifications about my subscription status, so that I stay informed about activations, renewals, and expirations.

#### Acceptance Criteria

1. WHEN a subscription is activated, THE System SHALL send a push notification welcoming the user to premium
2. WHEN a payment fails, THE System SHALL send a push notification informing the user of the failure
3. WHEN a subscription is cancelled, THE System SHALL send a confirmation push notification
4. THE System SHALL include relevant subscription details in notification data payloads
5. THE System SHALL only send notifications to users with valid push tokens
6. THE System SHALL log notification delivery attempts for debugging

### Requirement 13: Subscription Data Validation

**User Story:** As the system, I want to validate subscription data, so that I maintain data integrity and prevent invalid states.

#### Acceptance Criteria

1. THE System SHALL validate that subscription end dates are after start dates
2. THE System SHALL validate that trial end dates are 7 days after start dates for new subscriptions
3. THE System SHALL validate that subscription plans are either monthly or annual
4. THE System SHALL validate that subscription statuses are one of: pending, trial, active, expired, or cancelled
5. THE System SHALL validate that amounts are positive numbers
6. THE System SHALL validate that user IDs reference existing users in the database
7. THE System SHALL create database indexes on userId, status, and endDate fields for performance

### Requirement 14: Transaction Data Validation

**User Story:** As the system, I want to validate transaction data, so that I maintain accurate payment records.

#### Acceptance Criteria

1. THE System SHALL ensure NabooPay transaction IDs are unique across all transactions
2. THE System SHALL validate that transaction amounts are positive numbers
3. THE System SHALL validate that transaction statuses are one of: pending, completed, failed, or refunded
4. THE System SHALL validate that payment methods are one of the supported options
5. THE System SHALL validate that currencies match the subscription currency (XOF)
6. THE System SHALL create a unique index on nabooTransactionId for fast webhook lookups
7. THE System SHALL store the complete NabooPay response payload for audit and debugging

### Requirement 15: Error Handling for Payment Failures

**User Story:** As a user, I want clear error messages when payments fail, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN NabooPay API is unavailable, THE System SHALL return a 503 Service Unavailable error with a retry message
2. WHEN a payment initialization fails, THE System SHALL log the error and return a user-friendly error message
3. WHEN a webhook indicates payment failure, THE System SHALL store the failure reason from NabooPay
4. THE System SHALL provide specific error messages for different failure types (insufficient funds, expired card, network error)
5. THE System SHALL allow users to retry failed payment attempts
6. THE System SHALL log all payment errors with sufficient detail for debugging

