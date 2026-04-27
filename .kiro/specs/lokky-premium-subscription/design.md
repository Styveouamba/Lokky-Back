# Design Document: Lokky Premium Subscription

## Overview

This design document outlines the implementation of a comprehensive premium subscription system for Lokky, a local social discovery app. The system integrates NabooPay payment gateway (supporting Wave, Orange Money, and Visa for West African markets), implements premium features including activity boosting, photo gallery, profile view tracking, recurring activities, and premium badges. The architecture follows the existing Node.js/Express/MongoDB/Firebase stack with TypeScript, ensuring seamless integration with current authentication, activity management, and notification systems.

## Architecture

```mermaid
graph TB
    subgraph "Frontend (React Native + Expo)"
        A[User Interface]
        B[Subscription Manager]
        C[Premium Features UI]
        D[Payment Flow]
    end
    
    subgraph "Backend API (Node.js + Express)"
        E[Subscription Controller]
        F[Payment Webhook Handler]
        G[Premium Middleware]
        H[Gallery Controller]
        I[Profile View Controller]
        J[Recurring Activity Service]
    end
    
    subgraph "External Services"
        K[NabooPay API v2]
        L[Firebase Storage]
        M[Cloudinary]
    end
    
    subgraph "Database (MongoDB)"
        N[Subscriptions Collection]
        O[Transactions Collection]
        P[Gallery Collection]
        Q[Profile Views Collection]
        R[Recurring Templates Collection]
    end
    
    subgraph "Background Jobs"
        S[Subscription Renewal Cron]
        T[Trial Expiry Checker]
        U[Recurring Activity Generator]
    end
    
    A --> B
    B --> D
    D --> E
    E --> K
    K --> F
    F --> N
    F --> O
    
    B --> G
    G --> N
    
    C --> H
    C --> I
    H --> P
    H --> L
    I --> Q
    
    C --> J
    J --> R
    
    S --> N
    T --> N
    U --> R
    
    E --> N
    E --> O


## Main Workflow: Subscription Purchase Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend API
    participant NP as NabooPay
    participant DB as MongoDB
    participant WH as Webhook Handler
    
    U->>FE: Select subscription plan
    FE->>BE: POST /api/subscriptions/initiate
    BE->>DB: Create pending subscription
    BE->>NP: Initialize payment
    NP-->>BE: Payment URL + transaction_id
    BE-->>FE: Return payment URL
    FE->>U: Open payment page
    U->>NP: Complete payment (Wave/Orange/Visa)
    NP->>WH: POST /api/webhooks/naboo-payment
    WH->>NP: Verify webhook signature
    WH->>DB: Update subscription status to 'active'
    WH->>DB: Create transaction record
    WH->>U: Send push notification (success)
    WH-->>NP: 200 OK
    FE->>BE: Poll subscription status
    BE-->>FE: Subscription active
    FE->>U: Show premium features unlocked


## Components and Interfaces

### Component 1: Subscription Management System

**Purpose**: Manages user subscriptions, payment processing, and premium status validation

**Interface**:
```typescript
interface ISubscriptionController {
  initiatePurchase(req: AuthRequest, res: Response): Promise<void>
  getSubscriptionStatus(req: AuthRequest, res: Response): Promise<void>
  cancelSubscription(req: AuthRequest, res: Response): Promise<void>
  getSubscriptionHistory(req: AuthRequest, res: Response): Promise<void>
}

interface IPaymentWebhookHandler {
  handleNabooPayment(req: Request, res: Response): Promise<void>
  verifyWebhookSignature(payload: string, signature: string): boolean
}
```

**Responsibilities**:
- Initialize payment transactions with NabooPay
- Track subscription lifecycle (trial, active, expired, cancelled)
- Handle payment confirmations via webhooks
- Manage auto-renewal logic
- Validate premium access for protected features

### Component 2: Premium Middleware

**Purpose**: Validates premium subscription status for protected routes

**Interface**:
```typescript
interface IPremiumMiddleware {
  requirePremium(req: AuthRequest, res: Response, next: NextFunction): Promise<void>
  checkPremiumStatus(userId: string): Promise<boolean>
  getPremiumFeatures(userId: string): Promise<string[]>
}
```

**Responsibilities**:
- Verify active premium subscription before accessing premium features
- Check trial period validity
- Return appropriate error messages for non-premium users
- Cache premium status for performance

### Component 3: Gallery Management System

**Purpose**: Handles photo album creation, storage, and display for premium users

**Interface**:
```typescript
interface IGalleryController {
  createAlbum(req: AuthRequest, res: Response): Promise<void>
  uploadPhotos(req: AuthRequest, res: Response): Promise<void>
  getGalleryFeed(req: AuthRequest, res: Response): Promise<void>
  likeAlbum(req: AuthRequest, res: Response): Promise<void>
  commentOnAlbum(req: AuthRequest, res: Response): Promise<void>
  deleteAlbum(req: AuthRequest, res: Response): Promise<void>
}
```

**Responsibilities**:
- Create photo albums linked to activities (max 10 photos)
- Upload and store images via Firebase Storage or Cloudinary
- Provide Pinterest-style grid feed with filtering (category, city)
- Handle likes and comments from all users
- Implement moderation queue for new albums

### Component 4: Profile View Tracking System

**Purpose**: Tracks and displays profile visitors for premium users

**Interface**:
```typescript
interface IProfileViewController {
  recordProfileView(viewerId: string, profileId: string): Promise<void>
  getProfileViewers(req: AuthRequest, res: Response): Promise<void>
  getProfileViewStats(req: AuthRequest, res: Response): Promise<void>
}
```

**Responsibilities**:
- Record profile view events with timestamps
- Prevent duplicate views within 24-hour window
- Provide list of recent visitors (last 30 days)
- Calculate daily/weekly view statistics
- Only expose data to premium users

### Component 5: Recurring Activity System

**Purpose**: Enables premium users to create repeating events

**Interface**:
```typescript
interface IRecurringActivityService {
  createRecurringTemplate(req: AuthRequest, res: Response): Promise<void>
  generateNextOccurrence(templateId: string): Promise<void>
  updateRecurringTemplate(req: AuthRequest, res: Response): Promise<void>
  deleteRecurringTemplate(req: AuthRequest, res: Response): Promise<void>
  getRecurringActivities(req: AuthRequest, res: Response): Promise<void>
}
```

**Responsibilities**:
- Create recurring activity templates (daily, weekly, monthly)
- Auto-generate future activity instances via cron job
- Manage all occurrences centrally
- Handle template updates and deletions
- Sync with existing activity system

### Component 6: Premium Badge System

**Purpose**: Displays premium status indicators across the app

**Interface**:
```typescript
interface IPremiumBadgeService {
  addBadgeToUser(userId: string): Promise<void>
  removeBadgeFromUser(userId: string): Promise<void>
  addBadgeToActivity(activityId: string): Promise<void>
  getUsersWithBadges(userIds: string[]): Promise<Map<string, boolean>>
}
```

**Responsibilities**:
- Add premium badge to user profiles
- Add premium badge to activities created by premium users
- Provide badge status in API responses
- Update badge visibility when subscription changes


## Data Models

### Model 1: Subscription

```typescript
interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId
  plan: 'monthly' | 'annual'
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'pending'
  startDate: Date
  endDate: Date
  trialEndDate?: Date
  autoRenew: boolean
  paymentMethod: 'wave' | 'orange_money' | 'visa'
  amount: number
  currency: 'XOF' | 'EUR'
  nabooTransactionId?: string
  nabooCustomerId?: string
  cancelledAt?: Date
  cancellationReason?: string
  createdAt: Date
  updatedAt: Date
}
```

**Validation Rules**:
- `userId` must reference existing User document
- `plan` must be either 'monthly' (2,500 FCFA) or 'annual' (20,000 FCFA)
- `status` transitions: pending → trial → active → expired/cancelled
- `trialEndDate` must be 7 days after `startDate` for new subscriptions
- `endDate` must be after `startDate`
- `autoRenew` defaults to true
- `amount` must match plan pricing

**Indexes**:
- `userId` (for user lookup)
- `status` (for filtering active subscriptions)
- `endDate` (for expiry checks)
- Compound index: `{ userId: 1, status: 1 }`

### Model 2: Transaction

```typescript
interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId
  subscriptionId: mongoose.Types.ObjectId
  nabooTransactionId: string
  amount: number
  currency: 'XOF' | 'EUR'
  paymentMethod: 'wave' | 'orange_money' | 'visa'
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  nabooStatus?: string
  nabooResponse?: any
  webhookReceived: boolean
  webhookReceivedAt?: Date
  failureReason?: string
  metadata?: {
    plan: string
    isRenewal: boolean
    isTrial: boolean
  }
  createdAt: Date
  updatedAt: Date
}
```

**Validation Rules**:
- `nabooTransactionId` must be unique
- `amount` must be positive
- `status` transitions: pending → completed/failed
- `webhookReceived` tracks webhook delivery
- `metadata` stores additional context

**Indexes**:
- `nabooTransactionId` (unique, for webhook lookups)
- `userId` (for transaction history)
- `subscriptionId` (for subscription-transaction linking)
- `status` (for filtering)

### Model 3: GalleryAlbum

```typescript
interface IGalleryAlbum extends Document {
  userId: mongoose.Types.ObjectId
  activityId: mongoose.Types.ObjectId
  title: string
  description?: string
  photos: {
    url: string
    thumbnailUrl: string
    storageProvider: 'firebase' | 'cloudinary'
    storagePath: string
    uploadedAt: Date
  }[]
  category: string
  city: string
  location?: {
    type: 'Point'
    coordinates: [number, number]
  }
  likes: mongoose.Types.ObjectId[]
  likesCount: number
  comments: {
    userId: mongoose.Types.ObjectId
    text: string
    createdAt: Date
  }[]
  commentsCount: number
  views: number
  moderation: {
    status: 'pending' | 'approved' | 'rejected'
    reviewedBy?: mongoose.Types.ObjectId
    reviewedAt?: Date
    rejectionReason?: string
  }
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}
```

**Validation Rules**:
- `userId` must have active premium subscription
- `photos` array max length: 10
- `category` must match activity categories
- `moderation.status` defaults to 'pending'
- `likesCount` and `commentsCount` are denormalized for performance

**Indexes**:
- `userId` (for user's albums)
- `activityId` (for activity-album linking)
- `category` (for filtering)
- `city` (for filtering)
- `moderation.status` (for moderation queue)
- `createdAt` (for sorting)
- Compound index: `{ category: 1, city: 1, 'moderation.status': 1 }`

### Model 4: ProfileView

```typescript
interface IProfileView extends Document {
  viewerId: mongoose.Types.ObjectId
  profileId: mongoose.Types.ObjectId
  viewedAt: Date
  source?: 'activity' | 'search' | 'gallery' | 'direct'
  createdAt: Date
}
```

**Validation Rules**:
- `viewerId` cannot equal `profileId` (no self-views)
- Unique constraint: one view per viewer per profile per 24 hours
- `viewedAt` defaults to current timestamp

**Indexes**:
- `profileId` (for retrieving viewers)
- `viewedAt` (for time-based queries)
- Compound index: `{ profileId: 1, viewedAt: -1 }` (for recent viewers)
- TTL index: expire documents after 90 days

### Model 5: RecurringActivityTemplate

```typescript
interface IRecurringActivityTemplate extends Document {
  userId: mongoose.Types.ObjectId
  title: string
  description?: string
  category: string
  tags: string[]
  location: {
    type: 'Point'
    coordinates: [number, number]
    name: string
    city?: string
  }
  duration: number
  maxParticipants: number
  imageUrl?: string
  recurrence: {
    frequency: 'daily' | 'weekly' | 'monthly'
    dayOfWeek?: number // 0-6 for weekly (0 = Sunday)
    dayOfMonth?: number // 1-31 for monthly
    time: string // HH:mm format
  }
  isActive: boolean
  lastGeneratedDate?: Date
  nextGenerationDate: Date
  endDate?: Date // Optional end date for recurrence
  generatedActivities: mongoose.Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}
```

**Validation Rules**:
- `userId` must have active premium subscription
- `recurrence.frequency` determines which fields are required:
  - weekly: `dayOfWeek` required
  - monthly: `dayOfMonth` required
- `recurrence.time` must be valid HH:mm format
- `nextGenerationDate` calculated based on frequency
- `isActive` can be toggled to pause generation

**Indexes**:
- `userId` (for user's templates)
- `isActive` (for active templates)
- `nextGenerationDate` (for cron job)
- Compound index: `{ isActive: 1, nextGenerationDate: 1 }`


## API Endpoints

### Subscription Management

**POST /api/subscriptions/initiate**
- Auth: Required
- Body: `{ plan: 'monthly' | 'annual', paymentMethod: 'wave' | 'orange_money' | 'visa' }`
- Response: `{ paymentUrl: string, transactionId: string, subscriptionId: string }`
- Description: Initiates subscription purchase, creates pending subscription, returns NabooPay payment URL

**GET /api/subscriptions/status**
- Auth: Required
- Response: `{ subscription: ISubscription, isPremium: boolean, features: string[] }`
- Description: Returns current subscription status and available features

**POST /api/subscriptions/cancel**
- Auth: Required
- Body: `{ reason?: string }`
- Response: `{ message: string, subscription: ISubscription }`
- Description: Cancels auto-renewal, subscription remains active until end date

**GET /api/subscriptions/history**
- Auth: Required
- Query: `?page=1&limit=20`
- Response: `{ transactions: ITransaction[], pagination: {...} }`
- Description: Returns user's transaction history

**POST /api/webhooks/naboo-payment**
- Auth: Webhook signature verification
- Body: NabooPay webhook payload
- Response: `{ received: true }`
- Description: Handles payment confirmation from NabooPay

### Gallery Management

**POST /api/gallery/albums**
- Auth: Required (Premium)
- Body: `{ activityId: string, title: string, description?: string }`
- Response: `{ album: IGalleryAlbum }`
- Description: Creates new photo album for activity

**POST /api/gallery/albums/:albumId/photos**
- Auth: Required (Premium)
- Body: FormData with photos (max 10)
- Response: `{ album: IGalleryAlbum, uploadedPhotos: string[] }`
- Description: Uploads photos to album

**GET /api/gallery/feed**
- Auth: Required
- Query: `?category=sport&city=Dakar&page=1&limit=20`
- Response: `{ albums: IGalleryAlbum[], pagination: {...} }`
- Description: Returns gallery feed with filters (Pinterest-style)

**POST /api/gallery/albums/:albumId/like**
- Auth: Required
- Response: `{ album: IGalleryAlbum, liked: boolean }`
- Description: Toggles like on album

**POST /api/gallery/albums/:albumId/comments**
- Auth: Required
- Body: `{ text: string }`
- Response: `{ album: IGalleryAlbum, comment: {...} }`
- Description: Adds comment to album

**DELETE /api/gallery/albums/:albumId**
- Auth: Required (Owner or Admin)
- Response: `{ message: string }`
- Description: Soft deletes album

### Profile View Tracking

**POST /api/profile-views/:userId**
- Auth: Required
- Response: `{ recorded: boolean }`
- Description: Records profile view (internal, called automatically)

**GET /api/profile-views/viewers**
- Auth: Required (Premium)
- Query: `?days=30&page=1&limit=50`
- Response: `{ viewers: Array<{ user: IUser, viewedAt: Date }>, total: number }`
- Description: Returns list of profile viewers

**GET /api/profile-views/stats**
- Auth: Required (Premium)
- Query: `?period=week`
- Response: `{ daily: number[], weekly: number, total: number }`
- Description: Returns view statistics

### Recurring Activities

**POST /api/recurring-activities**
- Auth: Required (Premium)
- Body: `{ title, description, category, location, duration, maxParticipants, recurrence: {...} }`
- Response: `{ template: IRecurringActivityTemplate }`
- Description: Creates recurring activity template

**GET /api/recurring-activities**
- Auth: Required (Premium)
- Response: `{ templates: IRecurringActivityTemplate[] }`
- Description: Returns user's recurring activity templates

**PATCH /api/recurring-activities/:templateId**
- Auth: Required (Premium, Owner)
- Body: Partial template fields
- Response: `{ template: IRecurringActivityTemplate }`
- Description: Updates recurring template

**DELETE /api/recurring-activities/:templateId**
- Auth: Required (Premium, Owner)
- Response: `{ message: string }`
- Description: Deletes template and optionally future occurrences

**POST /api/recurring-activities/:templateId/toggle**
- Auth: Required (Premium, Owner)
- Response: `{ template: IRecurringActivityTemplate, isActive: boolean }`
- Description: Toggles template active status

### Premium Badge

**GET /api/users/:userId/premium-status**
- Auth: Required
- Response: `{ isPremium: boolean, badge: boolean, since?: Date }`
- Description: Returns user's premium status (for displaying badges)


## Key Algorithms and Business Logic

### Algorithm 1: NabooPay Payment Initialization

```typescript
async function initializeNabooPayment(
  userId: string,
  plan: 'monthly' | 'annual',
  paymentMethod: 'wave' | 'orange_money' | 'visa'
): Promise<{ paymentUrl: string; transactionId: string; subscriptionId: string }> {
  // 1. Validate user doesn't have active subscription
  const existingSubscription = await Subscription.findOne({
    userId,
    status: { $in: ['active', 'trial'] }
  })
  
  if (existingSubscription) {
    throw new Error('User already has active subscription')
  }
  
  // 2. Calculate pricing
  const pricing = {
    monthly: { amount: 2500, currency: 'XOF' },
    annual: { amount: 20000, currency: 'XOF' }
  }
  const { amount, currency } = pricing[plan]
  
  // 3. Create pending subscription
  const subscription = await Subscription.create({
    userId,
    plan,
    status: 'pending',
    amount,
    currency,
    paymentMethod,
    autoRenew: true,
    startDate: new Date(),
    endDate: calculateEndDate(plan),
    trialEndDate: addDays(new Date(), 7)
  })
  
  // 4. Initialize NabooPay transaction
  const nabooResponse = await axios.post(
    `${NABOO_API_URL}/v2/payments/initialize`,
    {
      amount,
      currency,
      payment_method: paymentMethod,
      customer_email: user.email,
      customer_name: user.name,
      return_url: `${APP_URL}/subscription/success`,
      cancel_url: `${APP_URL}/subscription/cancel`,
      webhook_url: `${API_URL}/api/webhooks/naboo-payment`,
      metadata: {
        subscriptionId: subscription._id.toString(),
        userId: userId,
        plan: plan
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${NABOO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  )
  
  // 5. Store transaction
  await Transaction.create({
    userId,
    subscriptionId: subscription._id,
    nabooTransactionId: nabooResponse.data.transaction_id,
    amount,
    currency,
    paymentMethod,
    status: 'pending',
    webhookReceived: false,
    metadata: {
      plan,
      isRenewal: false,
      isTrial: true
    }
  })
  
  // 6. Update subscription with NabooPay reference
  subscription.nabooTransactionId = nabooResponse.data.transaction_id
  await subscription.save()
  
  return {
    paymentUrl: nabooResponse.data.payment_url,
    transactionId: nabooResponse.data.transaction_id,
    subscriptionId: subscription._id.toString()
  }
}
```

**Preconditions**:
- User must be authenticated
- User must not have active or trial subscription
- Payment method must be supported by NabooPay
- NabooPay API must be accessible

**Postconditions**:
- Pending subscription created in database
- Transaction record created with 'pending' status
- NabooPay payment initialized
- Payment URL returned to user
- Webhook URL registered with NabooPay

### Algorithm 2: Webhook Payment Confirmation

```typescript
async function handleNabooWebhook(
  payload: any,
  signature: string
): Promise<void> {
  // 1. Verify webhook signature
  const isValid = verifyWebhookSignature(payload, signature)
  if (!isValid) {
    throw new Error('Invalid webhook signature')
  }
  
  // 2. Extract transaction data
  const {
    transaction_id,
    status,
    amount,
    currency,
    metadata
  } = payload
  
  // 3. Find transaction
  const transaction = await Transaction.findOne({
    nabooTransactionId: transaction_id
  })
  
  if (!transaction) {
    throw new Error('Transaction not found')
  }
  
  // 4. Update transaction status
  transaction.status = status === 'success' ? 'completed' : 'failed'
  transaction.nabooStatus = status
  transaction.nabooResponse = payload
  transaction.webhookReceived = true
  transaction.webhookReceivedAt = new Date()
  
  if (status !== 'success') {
    transaction.failureReason = payload.failure_reason
    await transaction.save()
    
    // Update subscription to failed
    await Subscription.findByIdAndUpdate(
      transaction.subscriptionId,
      { status: 'expired' }
    )
    
    return
  }
  
  await transaction.save()
  
  // 5. Activate subscription
  const subscription = await Subscription.findById(transaction.subscriptionId)
  if (!subscription) {
    throw new Error('Subscription not found')
  }
  
  subscription.status = 'trial' // Start with trial
  subscription.startDate = new Date()
  subscription.trialEndDate = addDays(new Date(), 7)
  subscription.endDate = calculateEndDate(subscription.plan, subscription.trialEndDate)
  await subscription.save()
  
  // 6. Update user model with premium flag
  await User.findByIdAndUpdate(
    subscription.userId,
    { 
      'premium.isActive': true,
      'premium.since': new Date(),
      'premium.plan': subscription.plan
    }
  )
  
  // 7. Send success notification
  const user = await User.findById(subscription.userId)
  if (user?.pushToken) {
    await sendPushNotification(user.pushToken, {
      title: 'Bienvenue dans Lokky Premium! 🎉',
      body: 'Votre période d\'essai de 7 jours a commencé. Profitez de toutes les fonctionnalités premium!',
      data: { type: 'subscription_activated' }
    })
  }
  
  // 8. Log event
  console.log(`[Subscription] User ${subscription.userId} activated premium (${subscription.plan})`)
}
```

**Preconditions**:
- Webhook signature must be valid
- Transaction must exist in database
- Subscription must exist and be in 'pending' status

**Postconditions**:
- Transaction status updated to 'completed' or 'failed'
- Subscription status updated to 'trial' (on success) or 'expired' (on failure)
- User model updated with premium flag
- Push notification sent to user
- Webhook acknowledged with 200 OK

### Algorithm 3: Subscription Renewal Check (Cron Job)

```typescript
async function checkSubscriptionRenewals(): Promise<void> {
  // Run daily at 00:00 UTC
  
  // 1. Find subscriptions expiring in next 24 hours with auto-renew enabled
  const expiringSubscriptions = await Subscription.find({
    status: 'active',
    autoRenew: true,
    endDate: {
      $gte: new Date(),
      $lte: addDays(new Date(), 1)
    }
  }).populate('userId')
  
  for (const subscription of expiringSubscriptions) {
    try {
      // 2. Initialize renewal payment
      const nabooResponse = await axios.post(
        `${NABOO_API_URL}/v2/payments/initialize`,
        {
          amount: subscription.amount,
          currency: subscription.currency,
          payment_method: subscription.paymentMethod,
          customer_id: subscription.nabooCustomerId,
          auto_charge: true, // Automatic charge for renewal
          webhook_url: `${API_URL}/api/webhooks/naboo-payment`,
          metadata: {
            subscriptionId: subscription._id.toString(),
            userId: subscription.userId._id.toString(),
            plan: subscription.plan,
            isRenewal: true
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${NABOO_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      // 3. Create transaction record
      await Transaction.create({
        userId: subscription.userId._id,
        subscriptionId: subscription._id,
        nabooTransactionId: nabooResponse.data.transaction_id,
        amount: subscription.amount,
        currency: subscription.currency,
        paymentMethod: subscription.paymentMethod,
        status: 'pending',
        webhookReceived: false,
        metadata: {
          plan: subscription.plan,
          isRenewal: true,
          isTrial: false
        }
      })
      
      // 4. Send notification about renewal attempt
      if (subscription.userId.pushToken) {
        await sendPushNotification(subscription.userId.pushToken, {
          title: 'Renouvellement en cours',
          body: `Votre abonnement ${subscription.plan === 'monthly' ? 'mensuel' : 'annuel'} est en cours de renouvellement.`,
          data: { type: 'subscription_renewal' }
        })
      }
      
    } catch (error) {
      console.error(`[Renewal] Failed for subscription ${subscription._id}:`, error)
      
      // Mark subscription as expired
      subscription.status = 'expired'
      await subscription.save()
      
      // Update user premium status
      await User.findByIdAndUpdate(
        subscription.userId._id,
        { 'premium.isActive': false }
      )
      
      // Notify user of failure
      if (subscription.userId.pushToken) {
        await sendPushNotification(subscription.userId.pushToken, {
          title: 'Échec du renouvellement',
          body: 'Le renouvellement de votre abonnement a échoué. Veuillez mettre à jour vos informations de paiement.',
          data: { type: 'subscription_renewal_failed' }
        })
      }
    }
  }
}
```

**Preconditions**:
- Cron job runs daily at scheduled time
- NabooPay API supports auto-charge for renewals
- User payment method is still valid

**Postconditions**:
- Renewal payment initiated for expiring subscriptions
- Transaction records created
- Users notified of renewal attempts
- Failed renewals marked as expired
- Premium status updated accordingly

### Algorithm 4: Trial Expiry Check (Cron Job)

```typescript
async function checkTrialExpiries(): Promise<void> {
  // Run daily at 00:00 UTC
  
  // 1. Find subscriptions with expired trials
  const expiredTrials = await Subscription.find({
    status: 'trial',
    trialEndDate: { $lte: new Date() }
  }).populate('userId')
  
  for (const subscription of expiredTrials) {
    // 2. Transition from trial to active
    subscription.status = 'active'
    await subscription.save()
    
    // 3. Send notification
    if (subscription.userId.pushToken) {
      await sendPushNotification(subscription.userId.pushToken, {
        title: 'Période d\'essai terminée',
        body: 'Votre essai gratuit est terminé. Votre abonnement premium est maintenant actif!',
        data: { type: 'trial_ended' }
      })
    }
    
    console.log(`[Trial] User ${subscription.userId._id} trial ended, now active`)
  }
}
```

**Preconditions**:
- Cron job runs daily
- Subscriptions in 'trial' status exist

**Postconditions**:
- Trial subscriptions transitioned to 'active'
- Users notified of trial end
- Premium access continues uninterrupted

### Algorithm 5: Recurring Activity Generation (Cron Job)

```typescript
async function generateRecurringActivities(): Promise<void> {
  // Run every hour
  
  // 1. Find templates ready for generation
  const templates = await RecurringActivityTemplate.find({
    isActive: true,
    nextGenerationDate: { $lte: new Date() }
  }).populate('userId')
  
  for (const template of templates) {
    try {
      // 2. Verify user still has premium
      const subscription = await Subscription.findOne({
        userId: template.userId._id,
        status: { $in: ['trial', 'active'] }
      })
      
      if (!subscription) {
        // Deactivate template if user no longer premium
        template.isActive = false
        await template.save()
        continue
      }
      
      // 3. Calculate next occurrence date/time
      const nextDate = calculateNextOccurrence(
        template.recurrence.frequency,
        template.recurrence.dayOfWeek,
        template.recurrence.dayOfMonth,
        template.recurrence.time
      )
      
      // 4. Check if we should stop (end date reached)
      if (template.endDate && nextDate > template.endDate) {
        template.isActive = false
        await template.save()
        continue
      }
      
      // 5. Create activity instance
      const activity = await Activity.create({
        title: template.title,
        description: template.description,
        category: template.category,
        tags: [...template.tags, 'recurring'],
        location: template.location,
        date: nextDate,
        duration: template.duration,
        maxParticipants: template.maxParticipants,
        imageUrl: template.imageUrl,
        createdBy: template.userId._id,
        participants: [template.userId._id],
        status: 'upcoming',
        recurringTemplateId: template._id // Link back to template
      })
      
      // 6. Create group for activity
      const group = await Group.create({
        name: template.title,
        description: template.description || `Groupe pour ${template.title}`,
        avatar: template.imageUrl,
        createdBy: template.userId._id,
        members: [template.userId._id],
        admins: [template.userId._id],
        isPrivate: false
      })
      
      activity.groupId = group._id
      await activity.save()
      
      // 7. Update template
      template.lastGeneratedDate = new Date()
      template.nextGenerationDate = calculateNextGenerationDate(
        template.recurrence.frequency,
        template.recurrence.dayOfWeek,
        template.recurrence.dayOfMonth,
        template.recurrence.time
      )
      template.generatedActivities.push(activity._id)
      await template.save()
      
      console.log(`[Recurring] Generated activity ${activity._id} from template ${template._id}`)
      
    } catch (error) {
      console.error(`[Recurring] Failed to generate from template ${template._id}:`, error)
    }
  }
}
```

**Preconditions**:
- Cron job runs hourly
- Templates exist with `isActive: true`
- `nextGenerationDate` is in the past or present

**Postconditions**:
- New activity instances created for each template
- Groups created for each activity
- Template `nextGenerationDate` updated
- Inactive templates skipped
- Templates deactivated if user no longer premium or end date reached

### Algorithm 6: Activity Boost Ranking

```typescript
function applyPremiumBoost(
  activities: IActivity[],
  userLocation: [number, number]
): IActivity[] {
  // 1. Separate premium and non-premium activities
  const premiumActivities: IActivity[] = []
  const regularActivities: IActivity[] = []
  
  for (const activity of activities) {
    if (activity.createdBy.premium?.isActive) {
      premiumActivities.push(activity)
    } else {
      regularActivities.push(activity)
    }
  }
  
  // 2. Sort premium activities by relevance
  premiumActivities.sort((a, b) => {
    const distanceA = calculateDistance(userLocation, a.location.coordinates)
    const distanceB = calculateDistance(userLocation, b.location.coordinates)
    const fillRateA = a.participants.length / a.maxParticipants
    const fillRateB = b.participants.length / b.maxParticipants
    
    // Boost score: closer + higher fill rate = better
    const scoreA = (1 / (distanceA + 1)) * (1 + fillRateA)
    const scoreB = (1 / (distanceB + 1)) * (1 + fillRateB)
    
    return scoreB - scoreA
  })
  
  // 3. Sort regular activities by relevance
  regularActivities.sort((a, b) => {
    const distanceA = calculateDistance(userLocation, a.location.coordinates)
    const distanceB = calculateDistance(userLocation, b.location.coordinates)
    return distanceA - distanceB
  })
  
  // 4. Interleave: premium activities appear more frequently at top
  const result: IActivity[] = []
  let premiumIndex = 0
  let regularIndex = 0
  
  while (premiumIndex < premiumActivities.length || regularIndex < regularActivities.length) {
    // Add 2 premium activities
    for (let i = 0; i < 2 && premiumIndex < premiumActivities.length; i++) {
      result.push(premiumActivities[premiumIndex++])
    }
    
    // Add 1 regular activity
    if (regularIndex < regularActivities.length) {
      result.push(regularActivities[regularIndex++])
    }
  }
  
  return result
}
```

**Preconditions**:
- Activities array contains both premium and non-premium activities
- User location is provided
- Activity creators have `premium` field populated

**Postconditions**:
- Premium activities appear at top of feed
- Premium activities interleaved with regular activities (2:1 ratio)
- Activities sorted by relevance within their tier
- All activities included in result


## Error Handling

### Error Scenario 1: Payment Initialization Failure

**Condition**: NabooPay API is unavailable or returns error during payment initialization
**Response**: 
- Return 503 Service Unavailable to client
- Log error with transaction details
- Keep subscription in 'pending' state
- Allow user to retry

**Recovery**:
- Implement exponential backoff for retries
- Provide manual retry button in UI
- Send notification when service is restored

### Error Scenario 2: Webhook Signature Verification Failure

**Condition**: Webhook received with invalid signature (potential security threat)
**Response**:
- Return 401 Unauthorized
- Log security event with IP address and payload
- Do not process payment
- Alert admin team

**Recovery**:
- Verify NabooPay webhook secret is correct
- Check for API version changes
- Monitor for repeated failures

### Error Scenario 3: Duplicate Webhook Delivery

**Condition**: NabooPay sends same webhook multiple times (network retry)
**Response**:
- Check `webhookReceived` flag on transaction
- If already processed, return 200 OK immediately
- Do not update subscription again
- Log duplicate webhook event

**Recovery**:
- Idempotent webhook handler prevents duplicate processing
- No user impact

### Error Scenario 4: Subscription Renewal Failure

**Condition**: Auto-renewal payment fails (insufficient funds, expired card, etc.)
**Response**:
- Mark subscription as 'expired'
- Update user premium status to inactive
- Send push notification with failure reason
- Provide link to update payment method

**Recovery**:
- Allow user to manually renew with new payment method
- Offer grace period (3 days) before disabling premium features
- Send reminder notifications during grace period

### Error Scenario 5: Gallery Upload Failure

**Condition**: Image upload to Firebase Storage or Cloudinary fails
**Response**:
- Return 500 Internal Server Error
- Rollback album creation if no photos uploaded
- Log error with file details
- Provide user-friendly error message

**Recovery**:
- Implement retry logic with exponential backoff
- Fall back to alternative storage provider
- Allow user to retry upload
- Validate file size and format before upload

### Error Scenario 6: Recurring Activity Generation Failure

**Condition**: Cron job fails to create activity instance from template
**Response**:
- Log error with template ID and details
- Do not update `nextGenerationDate`
- Retry on next cron run
- Send notification to template owner if repeated failures

**Recovery**:
- Manual intervention to fix template data
- Provide admin dashboard to view failed generations
- Allow user to manually trigger generation

### Error Scenario 7: Premium Access Validation Failure

**Condition**: User attempts to access premium feature but subscription check fails
**Response**:
- Return 403 Forbidden with clear message
- Log access attempt
- Provide link to subscription page

**Recovery**:
- Cache premium status with TTL to reduce database load
- Invalidate cache on subscription changes
- Provide "Upgrade to Premium" prompt in UI

### Error Scenario 8: Profile View Recording Failure

**Condition**: Database error when recording profile view
**Response**:
- Log error but do not block user experience
- Return success to client (silent failure)
- Retry in background

**Recovery**:
- Profile view tracking is non-critical
- Missing views acceptable for better UX
- Monitor error rate and investigate if high


## Testing Strategy

### Unit Testing Approach

**Subscription Management**:
- Test subscription creation with valid/invalid plans
- Test pricing calculation for monthly vs annual
- Test trial period calculation (7 days)
- Test subscription status transitions (pending → trial → active → expired)
- Test auto-renewal flag toggling
- Mock NabooPay API responses

**Payment Webhook Handler**:
- Test webhook signature verification with valid/invalid signatures
- Test transaction status updates (success, failure)
- Test duplicate webhook handling (idempotency)
- Test subscription activation on successful payment
- Test user premium flag updates
- Mock database operations

**Premium Middleware**:
- Test premium access validation for active subscriptions
- Test trial period validation
- Test expired subscription rejection
- Test cancelled subscription handling
- Test cache hit/miss scenarios

**Gallery Management**:
- Test album creation with valid activity
- Test photo upload with valid/invalid files
- Test max photo limit enforcement (10 photos)
- Test like/unlike functionality
- Test comment creation and retrieval
- Test moderation status filtering

**Profile View Tracking**:
- Test view recording with valid viewer/profile IDs
- Test duplicate view prevention (24-hour window)
- Test self-view prevention
- Test view statistics calculation (daily, weekly)
- Test TTL expiry (90 days)

**Recurring Activity Service**:
- Test template creation with valid recurrence patterns
- Test next occurrence calculation (daily, weekly, monthly)
- Test activity generation from template
- Test template deactivation when user loses premium
- Test end date enforcement

**Coverage Goals**: Minimum 80% code coverage for all premium features

### Property-Based Testing Approach

**Property Test Library**: fast-check (for TypeScript/Node.js)

**Property 1: Subscription End Date Calculation**
```typescript
// Property: End date must always be after start date
fc.assert(
  fc.property(
    fc.constantFrom('monthly', 'annual'),
    fc.date(),
    (plan, startDate) => {
      const endDate = calculateEndDate(plan, startDate)
      return endDate > startDate
    }
  )
)

// Property: Monthly subscription = 30 days, Annual = 365 days
fc.assert(
  fc.property(
    fc.date(),
    (startDate) => {
      const monthlyEnd = calculateEndDate('monthly', startDate)
      const annualEnd = calculateEndDate('annual', startDate)
      
      const monthlyDiff = differenceInDays(monthlyEnd, startDate)
      const annualDiff = differenceInDays(annualEnd, startDate)
      
      return monthlyDiff === 30 && annualDiff === 365
    }
  )
)
```

**Property 2: Activity Boost Ranking**
```typescript
// Property: Premium activities always appear before regular activities in top N results
fc.assert(
  fc.property(
    fc.array(activityGenerator(), { minLength: 10, maxLength: 100 }),
    fc.tuple(fc.float({ min: -180, max: 180 }), fc.float({ min: -90, max: 90 })),
    (activities, userLocation) => {
      const ranked = applyPremiumBoost(activities, userLocation)
      
      // Check first 10 results have higher premium ratio
      const top10 = ranked.slice(0, 10)
      const premiumCount = top10.filter(a => a.createdBy.premium?.isActive).length
      
      return premiumCount >= 6 // At least 60% premium in top 10
    }
  )
)
```

**Property 3: Recurring Activity Next Occurrence**
```typescript
// Property: Next occurrence must always be in the future
fc.assert(
  fc.property(
    fc.constantFrom('daily', 'weekly', 'monthly'),
    fc.integer({ min: 0, max: 6 }), // dayOfWeek
    fc.integer({ min: 1, max: 31 }), // dayOfMonth
    fc.constantFrom('09:00', '12:00', '18:00', '20:00'),
    (frequency, dayOfWeek, dayOfMonth, time) => {
      const nextDate = calculateNextOccurrence(frequency, dayOfWeek, dayOfMonth, time)
      return nextDate > new Date()
    }
  )
)

// Property: Weekly recurrence respects day of week
fc.assert(
  fc.property(
    fc.integer({ min: 0, max: 6 }),
    fc.constantFrom('09:00', '12:00', '18:00'),
    (dayOfWeek, time) => {
      const nextDate = calculateNextOccurrence('weekly', dayOfWeek, null, time)
      return nextDate.getDay() === dayOfWeek
    }
  )
)
```

**Property 4: Profile View Deduplication**
```typescript
// Property: Recording same view twice within 24h should not create duplicate
fc.assert(
  fc.property(
    fc.uuid(),
    fc.uuid(),
    async (viewerId, profileId) => {
      await recordProfileView(viewerId, profileId)
      await recordProfileView(viewerId, profileId)
      
      const views = await ProfileView.find({ viewerId, profileId })
      return views.length === 1
    }
  )
)
```

**Property 5: Gallery Photo Limit**
```typescript
// Property: Album cannot exceed 10 photos
fc.assert(
  fc.property(
    fc.array(fc.string(), { minLength: 1, maxLength: 20 }),
    async (photoUrls) => {
      const album = await GalleryAlbum.create({ /* ... */ })
      
      try {
        for (const url of photoUrls) {
          await addPhotoToAlbum(album._id, url)
        }
      } catch (error) {
        // Expected to throw when exceeding 10
      }
      
      const updatedAlbum = await GalleryAlbum.findById(album._id)
      return updatedAlbum.photos.length <= 10
    }
  )
)
```

### Integration Testing Approach

**NabooPay Integration**:
- Test full payment flow with NabooPay sandbox
- Test webhook delivery and processing
- Test payment method switching (Wave, Orange Money, Visa)
- Test refund scenarios
- Test network timeout handling

**Firebase Storage Integration**:
- Test image upload to Firebase Storage
- Test thumbnail generation
- Test image deletion
- Test storage quota limits
- Test concurrent uploads

**Cron Job Integration**:
- Test subscription renewal cron with test data
- Test trial expiry cron with test data
- Test recurring activity generation cron
- Test job failure recovery
- Test job idempotency

**End-to-End Testing**:
- Test complete subscription purchase flow (frontend → backend → NabooPay → webhook)
- Test premium feature access after subscription activation
- Test feature lockout after subscription expiry
- Test recurring activity creation and generation
- Test gallery album creation and viewing


## Performance Considerations

### Database Optimization

**Indexing Strategy**:
- Subscription collection: Compound index on `{ userId: 1, status: 1 }` for fast premium status checks
- Transaction collection: Unique index on `nabooTransactionId` for webhook lookups
- ProfileView collection: Compound index on `{ profileId: 1, viewedAt: -1 }` for recent viewers query
- GalleryAlbum collection: Compound index on `{ category: 1, city: 1, 'moderation.status': 1 }` for filtered feeds
- RecurringActivityTemplate collection: Compound index on `{ isActive: 1, nextGenerationDate: 1 }` for cron job

**Query Optimization**:
- Use `.lean()` for read-only queries to reduce memory overhead
- Implement pagination for all list endpoints (max 100 items per page)
- Use projection to limit returned fields (e.g., exclude large arrays when not needed)
- Implement cursor-based pagination for profile views (better performance than offset)

**Caching Strategy**:
- Cache premium status in Redis with 5-minute TTL
- Cache key: `premium:${userId}` → `{ isPremium: boolean, plan: string, expiresAt: Date }`
- Invalidate cache on subscription changes (activation, cancellation, expiry)
- Cache gallery feed results for 2 minutes (reduce database load)
- Use Redis for rate limiting premium feature access

### Image Upload Optimization

**Storage Strategy**:
- Use Firebase Storage for primary storage (better integration with existing Firebase setup)
- Generate thumbnails on upload (150x150, 300x300, 600x600)
- Use Cloudinary as fallback if Firebase quota exceeded
- Implement client-side image compression before upload (max 2MB per photo)
- Use progressive JPEG format for faster loading

**Upload Performance**:
- Support batch upload (up to 10 photos at once)
- Use multipart upload for large files
- Implement upload progress tracking
- Compress images server-side if client compression insufficient
- Delete temporary files immediately after upload

### API Response Time Targets

- Subscription status check: < 100ms (with caching)
- Payment initialization: < 2s (depends on NabooPay)
- Gallery feed load: < 500ms (with pagination and caching)
- Profile viewers list: < 300ms (with indexing)
- Recurring activity creation: < 1s
- Activity boost ranking: < 200ms (in-memory sorting)

### Webhook Processing

**Async Processing**:
- Acknowledge webhook immediately (return 200 OK within 100ms)
- Process payment confirmation asynchronously in background job
- Use message queue (Redis Bull) for reliable webhook processing
- Implement retry logic for failed webhook processing (exponential backoff)
- Store raw webhook payload for debugging

### Cron Job Performance

**Subscription Renewal Cron**:
- Process in batches of 50 subscriptions
- Run every hour to spread load
- Use database cursor for memory efficiency
- Implement circuit breaker for NabooPay API failures

**Recurring Activity Generation Cron**:
- Process in batches of 20 templates
- Run every hour
- Skip templates if user no longer premium (early exit)
- Limit to 100 future activities per template

### Scalability Considerations

**Horizontal Scaling**:
- Stateless API design allows multiple backend instances
- Use Redis for shared session/cache across instances
- Implement distributed locking for cron jobs (prevent duplicate execution)
- Use database connection pooling (max 10 connections per instance)

**Database Scaling**:
- Implement read replicas for heavy read operations (gallery feed, profile views)
- Use MongoDB sharding if user base exceeds 1M users
- Archive old transactions (> 2 years) to separate collection
- Implement soft deletes for gallery albums (faster than hard deletes)

**CDN Integration**:
- Serve gallery images through CDN (Firebase CDN or Cloudinary CDN)
- Cache static assets (premium badges, icons)
- Use edge caching for gallery feed (reduce origin load)


## Security Considerations

### Payment Security

**NabooPay Integration**:
- Store NabooPay API key in environment variables (never in code)
- Use HTTPS for all NabooPay API calls
- Verify webhook signatures using HMAC-SHA256
- Implement webhook signature rotation support
- Log all payment transactions for audit trail
- Never store full credit card details (PCI compliance)

**Webhook Security**:
- Validate webhook signature before processing
- Implement IP whitelist for NabooPay webhook endpoints
- Rate limit webhook endpoint (max 100 requests/minute)
- Log suspicious webhook attempts (invalid signatures, unknown IPs)
- Use idempotency keys to prevent replay attacks

### Premium Feature Access Control

**Authorization**:
- Verify premium status on every protected endpoint
- Use middleware to centralize premium checks
- Implement role-based access control (RBAC) for admin features
- Validate subscription expiry date on each request
- Prevent privilege escalation (users cannot modify other users' subscriptions)

**Token Security**:
- Use JWT with short expiration (1 hour)
- Implement refresh token rotation
- Invalidate tokens on subscription cancellation
- Store sensitive subscription data server-side only
- Never expose NabooPay credentials to frontend

### Data Privacy

**User Data Protection**:
- Encrypt sensitive subscription data at rest (payment method details)
- Implement GDPR-compliant data deletion (remove all subscription data on account deletion)
- Anonymize transaction logs after 2 years
- Provide user access to their subscription history
- Implement data export for GDPR compliance

**Profile View Privacy**:
- Only premium users can see who viewed their profile
- Implement view anonymization option (users can browse anonymously)
- Expire profile views after 90 days (TTL index)
- Allow users to clear their view history
- Do not expose view tracking to non-premium users

**Gallery Privacy**:
- Implement content moderation before public display
- Allow users to report inappropriate content
- Provide album deletion (soft delete with 30-day recovery)
- Respect activity privacy settings (private activities = private albums)
- Implement NSFW content filtering

### Rate Limiting

**API Rate Limits**:
- Subscription endpoints: 10 requests/minute per user
- Gallery upload: 5 uploads/hour per user
- Profile view recording: 100 views/hour per user
- Recurring activity creation: 10 templates per user (total limit)
- Comment creation: 20 comments/hour per user

**Abuse Prevention**:
- Implement CAPTCHA for subscription purchase (prevent fraud)
- Monitor for suspicious payment patterns (multiple failed attempts)
- Block users with repeated payment failures (potential fraud)
- Implement device fingerprinting for fraud detection
- Rate limit webhook endpoint by IP address

### Input Validation

**Subscription Data**:
- Validate plan type (only 'monthly' or 'annual')
- Validate payment method (only supported methods)
- Sanitize user input in cancellation reason
- Validate amount matches plan pricing
- Prevent negative amounts or zero amounts

**Gallery Data**:
- Validate image file types (only JPEG, PNG, WebP)
- Validate image file size (max 5MB per photo)
- Sanitize album titles and descriptions (prevent XSS)
- Validate photo count (max 10 per album)
- Scan uploaded images for malware

**Recurring Activity Data**:
- Validate recurrence frequency (only daily, weekly, monthly)
- Validate day of week (0-6) and day of month (1-31)
- Validate time format (HH:mm)
- Prevent creation of past dates
- Limit total templates per user (max 10)

### Audit Logging

**Security Events**:
- Log all subscription purchases and cancellations
- Log all payment webhook deliveries (success and failure)
- Log premium feature access attempts (authorized and unauthorized)
- Log admin actions (subscription modifications, refunds)
- Log suspicious activity (repeated failures, invalid signatures)

**Compliance**:
- Retain audit logs for 7 years (financial compliance)
- Implement log rotation and archival
- Provide audit trail for dispute resolution
- Monitor logs for security incidents
- Alert on anomalous patterns (spike in failures, unusual access patterns)


## Dependencies

### External Services

**NabooPay API v2**:
- Purpose: Payment gateway for West African markets
- Documentation: https://docs.naboopay.com/v2
- Required credentials: API key, webhook secret
- Supported payment methods: Wave, Orange Money, Visa
- Rate limits: 100 requests/minute
- Sandbox environment available for testing

**Firebase Storage**:
- Purpose: Image storage for gallery photos
- Already integrated in existing Lokky backend
- Storage quota: 5GB free tier (monitor usage)
- CDN included for fast image delivery
- Supports automatic thumbnail generation

**Cloudinary** (Fallback):
- Purpose: Alternative image storage and transformation
- Already integrated in existing Lokky backend
- Free tier: 25GB storage, 25GB bandwidth/month
- Automatic image optimization and resizing
- CDN included

### Backend Libraries

**Existing Dependencies** (already in package.json):
- `mongoose@^8.0.0` - MongoDB ODM
- `express@^4.18.2` - Web framework
- `jsonwebtoken@^9.0.2` - JWT authentication
- `firebase-admin@^13.8.0` - Firebase integration
- `cloudinary@^2.0.0` - Image upload
- `ioredis@^5.10.1` - Redis client for caching
- `expo-server-sdk@^5.0.0` - Push notifications
- `axios@^1.14.0` - HTTP client for NabooPay API

**New Dependencies Required**:
- `node-cron@^3.0.3` - Cron job scheduling for renewals and recurring activities
- `bull@^4.12.0` - Redis-based queue for webhook processing
- `crypto` (built-in) - Webhook signature verification
- `sharp@^0.33.0` - Image processing and thumbnail generation
- `date-fns@^3.0.0` - Date manipulation for recurring activities

### Frontend Libraries

**Existing Dependencies** (React Native + Expo):
- `expo-image-picker` - Photo selection for gallery
- `react-native-svg` - Premium badge icons
- `socket.io-client` - Real-time updates
- `zustand` - State management

**New Dependencies Required**:
- `@stripe/stripe-react-native@^0.37.0` - Alternative: For card input UI (if NabooPay doesn't provide)
- `react-native-webview@^13.6.0` - Display NabooPay payment page
- `react-native-fast-image@^8.6.3` - Optimized image loading for gallery
- `react-native-masonry-list@^2.0.0` - Pinterest-style grid layout for gallery
- `@react-native-community/datetimepicker@^7.6.0` - Time picker for recurring activities

### Infrastructure

**MongoDB**:
- Version: 8.0+
- Required for new collections: Subscriptions, Transactions, GalleryAlbums, ProfileViews, RecurringActivityTemplates
- Estimated storage: ~500MB for 10,000 premium users

**Redis**:
- Version: 5.0+
- Already used in existing backend
- Additional usage: Premium status caching, webhook queue, rate limiting
- Estimated memory: ~100MB for 10,000 premium users

**Node.js**:
- Version: 20.x LTS
- Already used in existing backend
- No changes required

**Cron Jobs**:
- Subscription renewal check: Daily at 00:00 UTC
- Trial expiry check: Daily at 00:00 UTC
- Recurring activity generation: Hourly
- Can use `node-cron` or external scheduler (e.g., AWS EventBridge, Heroku Scheduler)

### Development Tools

**Testing**:
- `jest@^29.7.0` - Already in project
- `supertest@^6.3.0` - API testing
- `fast-check@^3.15.0` - Property-based testing (new)
- `mongodb-memory-server@^9.1.0` - In-memory MongoDB for tests

**Monitoring**:
- Existing logging with custom logger
- Consider adding: Sentry for error tracking, DataDog for APM

### API Version Requirements

- NabooPay API: v2 (latest)
- Firebase Admin SDK: v13.8.0+
- MongoDB: 8.0+
- Node.js: 20.x LTS
- Expo SDK: Compatible with existing version

### Environment Variables Required

```bash
# NabooPay Configuration
NABOO_API_KEY=your_api_key_here
NABOO_WEBHOOK_SECRET=your_webhook_secret_here
NABOO_API_URL=https://api.naboopay.com
NABOO_SANDBOX_MODE=true # Set to false in production

# Premium Subscription Configuration
PREMIUM_MONTHLY_PRICE=2500
PREMIUM_ANNUAL_PRICE=20000
PREMIUM_CURRENCY=XOF
PREMIUM_TRIAL_DAYS=7

# Gallery Configuration
GALLERY_MAX_PHOTOS=10
GALLERY_MAX_FILE_SIZE=5242880 # 5MB in bytes
GALLERY_STORAGE_PROVIDER=firebase # or cloudinary

# Recurring Activities Configuration
RECURRING_MAX_TEMPLATES_PER_USER=10
RECURRING_GENERATION_CRON=0 * * * * # Every hour

# Redis Configuration (existing)
REDIS_URL=redis://localhost:6379

# MongoDB Configuration (existing)
MONGODB_URI=mongodb://localhost:27017/lokky
```

### Third-Party Service Costs

**NabooPay**:
- Transaction fee: ~2.5% per transaction
- Monthly fee: None (pay-per-transaction)
- Estimated cost: 62.5 FCFA per monthly subscription, 500 FCFA per annual

**Firebase Storage**:
- Free tier: 5GB storage, 1GB/day download
- Paid tier: $0.026/GB storage, $0.12/GB download
- Estimated cost: $5-20/month for 10,000 premium users

**Cloudinary** (if used):
- Free tier: 25GB storage, 25GB bandwidth
- Paid tier: $89/month for 100GB
- Estimated cost: $0-89/month depending on usage

**Redis** (if using managed service):
- AWS ElastiCache: ~$15/month for t3.micro
- Redis Cloud: Free tier available, $7/month for 100MB
- Estimated cost: $0-15/month


## Implementation Phases

### Phase 1: Core Subscription System (Week 1-2)

**Backend**:
1. Create Subscription and Transaction models
2. Implement subscription controller (initiate, status, cancel)
3. Integrate NabooPay API (payment initialization)
4. Implement webhook handler with signature verification
5. Create premium middleware for access control
6. Add premium fields to User model
7. Implement subscription status caching in Redis

**Frontend**:
1. Create subscription selection screen (monthly/annual)
2. Implement payment flow with WebView for NabooPay
3. Create subscription status screen
4. Add premium badge UI component
5. Implement subscription management screen (cancel, history)

**Testing**:
- Unit tests for subscription logic
- Integration tests with NabooPay sandbox
- Webhook delivery tests

### Phase 2: Activity Boost & Premium Badge (Week 3)

**Backend**:
1. Implement activity boost ranking algorithm
2. Modify activity feed endpoint to apply boost
3. Add premium badge to activity responses
4. Update activity creation to mark premium activities

**Frontend**:
1. Display premium badge on user profiles
2. Display premium badge on activities
3. Update activity feed to show boosted activities
4. Add visual indicators for premium content

**Testing**:
- Property-based tests for boost ranking
- Visual regression tests for badges

### Phase 3: Gallery System (Week 4-5)

**Backend**:
1. Create GalleryAlbum model
2. Implement gallery controller (create, upload, feed, like, comment)
3. Integrate image upload with Firebase Storage
4. Implement thumbnail generation
5. Create moderation queue
6. Add filtering by category and city

**Frontend**:
1. Create gallery tab with Pinterest-style grid
2. Implement photo upload flow (max 10 photos)
3. Create album detail screen
4. Implement like and comment functionality
5. Add category and city filters
6. Implement infinite scroll for feed

**Testing**:
- Image upload tests
- Gallery feed pagination tests
- Moderation workflow tests

### Phase 4: Profile View Tracking (Week 6)

**Backend**:
1. Create ProfileView model with TTL index
2. Implement profile view recording (automatic)
3. Implement profile viewers endpoint (premium only)
4. Implement view statistics endpoint
5. Add deduplication logic (24-hour window)

**Frontend**:
1. Create profile viewers screen (premium only)
2. Display view count on profile
3. Show recent visitors with timestamps
4. Add daily/weekly statistics charts
5. Implement "Upgrade to Premium" prompt for free users

**Testing**:
- View deduplication tests
- Statistics calculation tests
- Premium access control tests

### Phase 5: Recurring Activities (Week 7-8)

**Backend**:
1. Create RecurringActivityTemplate model
2. Implement recurring activity controller
3. Implement next occurrence calculation logic
4. Create cron job for activity generation
5. Link generated activities to templates
6. Implement template management (update, delete, toggle)

**Frontend**:
1. Create recurring activity creation screen
2. Add recurrence pattern selector (daily, weekly, monthly)
3. Add time picker for recurring activities
4. Create recurring activities management screen
5. Display recurring indicator on activities
6. Implement template editing

**Testing**:
- Recurrence calculation property tests
- Cron job execution tests
- Template management tests

### Phase 6: Background Jobs & Monitoring (Week 9)

**Backend**:
1. Implement subscription renewal cron job
2. Implement trial expiry cron job
3. Set up webhook processing queue with Bull
4. Implement distributed locking for cron jobs
5. Add monitoring and alerting
6. Implement audit logging

**Testing**:
- Cron job execution tests
- Renewal flow tests
- Queue processing tests

### Phase 7: Polish & Optimization (Week 10)

**Backend**:
1. Optimize database queries with indexes
2. Implement caching strategy
3. Add rate limiting
4. Performance testing and optimization
5. Security audit

**Frontend**:
1. Polish UI/UX for all premium features
2. Add loading states and error handling
3. Implement offline support where applicable
4. Add analytics tracking
5. User acceptance testing

**Testing**:
- End-to-end testing
- Performance testing
- Security testing
- User acceptance testing

## Migration Strategy

### Database Migrations

**User Model Update**:
```typescript
// Add premium fields to existing User model
db.users.updateMany(
  {},
  {
    $set: {
      'premium.isActive': false,
      'premium.plan': null,
      'premium.since': null,
      'premium.expiresAt': null
    }
  }
)
```

**Activity Model Update**:
```typescript
// Add recurringTemplateId field to existing Activity model
db.activities.updateMany(
  {},
  {
    $set: {
      'recurringTemplateId': null
    }
  }
)
```

### Backward Compatibility

- All new endpoints are additive (no breaking changes)
- Existing activity feed continues to work (boost is optional)
- Premium features are opt-in (no impact on free users)
- Existing user authentication remains unchanged

### Rollback Plan

- Keep feature flags for each premium feature
- Ability to disable premium features without code deployment
- Database migrations are reversible
- NabooPay integration can be disabled via environment variable

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Subscription Date Calculations

*For any* subscription start date and plan type (monthly or annual), the end date SHALL be exactly 30 days later for monthly plans and 365 days later for annual plans, and the trial end date SHALL be exactly 7 days after the start date for new subscriptions.

**Validates: Requirements 1.5, 1.6, 13.1, 13.2**

### Property 2: Duplicate Subscription Prevention

*For any* user with an existing subscription in trial or active status, attempting to create a new subscription SHALL be rejected with an error.

**Validates: Requirements 1.4**

### Property 3: Webhook Signature Verification

*For any* webhook payload and signature pair, the signature verification using HMAC-SHA256 SHALL correctly identify valid signatures (signed with the correct secret) and reject invalid signatures.

**Validates: Requirements 2.1, 2.2**

### Property 4: Webhook Idempotency

*For any* valid webhook, processing it multiple times SHALL produce the same final state as processing it once (idempotent operation).

**Validates: Requirements 2.6**

### Property 5: Payment Status Transitions

*For any* successful payment webhook, the transaction status SHALL transition to completed and the subscription status SHALL transition to trial, and *for any* failed payment webhook, the transaction status SHALL transition to failed and the subscription status SHALL transition to expired.

**Validates: Requirements 2.4, 2.5**

### Property 6: Premium Access Control

*For any* user, the Premium_Middleware SHALL grant access if and only if the user has a subscription with status trial or active, and SHALL deny access with 403 Forbidden for users with expired, cancelled, or no subscription.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.7**

### Property 7: Premium Status Caching

*For any* user, checking premium status SHALL first query Redis cache with key format premium:userId, return cached value if present, otherwise query database and cache result with 5-minute TTL, and *for any* subscription status change, the cache SHALL be invalidated.

**Validates: Requirements 3.5, 3.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

### Property 8: Premium Flag Synchronization

*For any* subscription, the user model premium fields (isActive, plan, since, expiresAt) SHALL be synchronized with the subscription status, with isActive true for trial/active subscriptions and false for expired/cancelled subscriptions.

**Validates: Requirements 2.8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**

### Property 9: Subscription Status Response Completeness

*For any* user requesting subscription status, the response SHALL include all required fields (plan, status, dates, isPremium flag, features list, autoRenew status), with isPremium true for active/trial subscriptions and false otherwise.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6**

### Property 10: Trial Period Calculation

*For any* user with a trial subscription, the days remaining calculation SHALL be accurate based on the current date and trial end date.

**Validates: Requirements 4.5**

### Property 11: Subscription Cancellation Behavior

*For any* premium user cancelling their subscription, the autoRenew flag SHALL be set to false, cancellation timestamp SHALL be recorded, and subscription status SHALL remain active (not immediately expired).

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 12: Transaction History Pagination

*For any* user with transactions, the transaction history endpoint SHALL return all transactions for that user, ordered by creation date descending, with pagination limiting results to 20 per page, and each transaction including all required fields (amount, currency, payment method, status, timestamp, metadata, plan).

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

### Property 13: Premium Badge Display Logic

*For any* user or activity, the premium badge indicator SHALL be included in API responses if and only if the user (or activity creator) has an active subscription, and badge visibility SHALL update immediately when subscription status changes.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

### Property 14: Data Validation Consistency

*For any* subscription or transaction, the system SHALL validate that: amounts are positive numbers, dates are logically ordered (end after start), plan types are valid (monthly or annual), statuses are valid enum values, payment methods are supported options, currencies are XOF, and user IDs reference existing users.

**Validates: Requirements 13.3, 13.4, 13.5, 13.6, 14.2, 14.3, 14.4, 14.5**

### Property 15: Transaction ID Uniqueness

*For any* NabooPay transaction ID, attempting to create multiple transactions with the same ID SHALL be rejected due to unique constraint.

**Validates: Requirements 14.1**

### Property 16: Pricing Validation

*For any* subscription purchase, the payment amount SHALL match the plan pricing (2,500 XOF for monthly, 20,000 XOF for annual), and transactions with mismatched amounts SHALL be rejected.

**Validates: Requirements 11.3, 11.4, 11.5**

### Property 17: Push Notification Delivery

*For any* subscription event (activation, failure, cancellation), the system SHALL send a push notification to users with valid push tokens, include relevant subscription details in the payload, and log the delivery attempt.

**Validates: Requirements 5.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**

### Property 18: Audit Data Persistence

*For any* webhook received, the system SHALL store the complete payload, timestamp, and processing result for audit purposes, and *for any* transaction, the complete NabooPay response SHALL be stored.

**Validates: Requirements 2.7, 14.7**

### Property 19: Error Handling and Logging

*For any* payment error (NabooPay unavailable, initialization failure, payment failure), the system SHALL log the error with sufficient detail, return appropriate HTTP status codes (503 for service unavailable), provide user-friendly error messages, store failure reasons, and allow retry attempts.

**Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6**

### Property 20: Data Persistence Round-Trip

*For any* subscription or transaction created, storing the data and then retrieving it SHALL return an equivalent object with all fields preserved (NabooPay transaction ID, payment method, metadata, etc.).

**Validates: Requirements 1.7, 10.5**

## Success Metrics

### Business Metrics

- Premium conversion rate: Target 5% of active users
- Monthly recurring revenue (MRR): Track growth
- Churn rate: Target < 10% monthly
- Average revenue per user (ARPU)
- Trial-to-paid conversion: Target 30%

### Technical Metrics

- Payment success rate: Target > 95%
- Webhook delivery success: Target > 99%
- API response time: < 500ms for 95th percentile
- Cron job success rate: Target > 99%
- Image upload success rate: Target > 98%

### User Engagement Metrics

- Gallery album creation rate (premium users)
- Recurring activity usage (% of premium users)
- Profile view engagement (views per premium user)
- Premium badge visibility (impressions)
- Feature adoption rate per premium feature
