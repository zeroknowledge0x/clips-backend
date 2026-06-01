# Pull Request: Earnings Summary, Payout Request, Queue Dashboard & Job Alerts

## Description

This PR implements four critical features for the clips-backend system:

1. **Monthly Earnings Summary Cron Job** (#195)
2. **Payout Request Endpoint** (#182)
3. **BullMQ Dashboard Integration** (#210)
4. **Failed Job Email Alerts** (#211)

## Changes Overview

### 1. Monthly Earnings Summary (#195)

**Database Changes:**
- Added `MonthlyEarning` table with fields: userId, year, month, totalAmount, currency, platformBreakdown
- Unique constraint on (userId, year, month)
- Proper indexes for performance

**Implementation:**
- `MonthlySummaryService` with automated cron job
- Runs on the 1st of each month at midnight
- Generates summaries for all users with platform breakdown
- Uses upsert to handle re-runs safely

**Files:**
- `src/earnings/monthly-summary.service.ts`
- `prisma/migrations/20260601_add_monthly_earning_and_payout_fields/migration.sql`

### 2. Payout Request Endpoint (#182)

**API Endpoint:**
```
POST /payouts/request
Body: { amount: number, currency: string, method: "fiat" | "stellar" }
```

**Features:**
- Validates minimum threshold (configurable via `MIN_PAYOUT_AMOUNT`)
- Checks sufficient balance against earnings
- Prevents duplicate pending payouts
- Verifies wallet (stellar) or payout method (fiat) exists
- Calculates fees and returns payout request ID
- Proper error handling and validation

**Files:**
- `src/payouts/dto/request-payout.dto.ts`
- `src/payouts/payouts.controller.ts`
- `src/payouts/payouts.service.ts`

### 3. BullMQ Dashboard (#210)

**Route:** `/admin/queues`

**Features:**
- Integrated @bull-board/api and @bull-board/express
- Visual interface for monitoring queues
- Connected queues: clip-generation, clip-posting, payout-retry
- Protected by JWT authentication + admin role
- Real-time job statistics and management

**Security:**
- Created `RolesGuard` for role-based access control
- Created `@Roles` decorator for route protection
- Only admin users can access dashboard

**Files:**
- `src/queue-dashboard/queue-dashboard.module.ts`
- `src/queue-dashboard/queue-dashboard.service.ts`
- `src/queue-dashboard/queue-dashboard.controller.ts`
- `src/auth/guards/roles.guard.ts`
- `src/auth/decorators/roles.decorator.ts`

### 4. Failed Job Email Alerts (#211)

**Implementation:**
- `JobFailureNotifierService` with event listeners on all critical queues
- Triggers only after all retry attempts exhausted
- Sends two types of notifications:

**Admin Notifications:**
- Includes job type, ID, error message, stack trace
- Contains full job data for debugging
- Sent to `ADMIN_EMAIL` environment variable

**User Notifications:**
- Sent for failed payout jobs
- Professional, user-friendly message
- Includes payout details and status

**Files:**
- `src/queue-dashboard/job-failure-notifier.service.ts`
- `src/auth/mail.service.ts` (added generic `sendEmail` method)

## Database Migration

```sql
-- New table
CREATE TABLE "MonthlyEarning" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "platformBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    UNIQUE("userId", "year", "month")
);

-- Modified Payout table
ALTER TABLE "Payout" 
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT;
```

## Dependencies Added

```json
{
  "@bull-board/api": "^6.1.0",
  "@bull-board/express": "^6.1.0"
}
```

## Environment Variables Required

```bash
# Payout configuration
MIN_PAYOUT_AMOUNT=10

# Email notifications
ADMIN_EMAIL=admin@example.com
```

## Testing

### Manual Testing Steps

1. **Monthly Summary:**
   ```bash
   # Wait for cron or manually trigger
   # Check MonthlyEarning table for records
   ```

2. **Payout Request:**
   ```bash
   curl -X POST http://localhost:3000/payouts/request \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"amount": 50, "currency": "USD", "method": "stellar"}'
   ```

3. **Queue Dashboard:**
   - Login as admin user
   - Navigate to http://localhost:3000/admin/queues
   - Verify all three queues are visible

4. **Email Alerts:**
   - Trigger a job failure
   - Check admin email for notification
   - Verify user receives notification for payout failures

## Code Quality

- ✅ TypeScript types throughout
- ✅ Proper error handling
- ✅ Input validation with class-validator
- ✅ Security: Admin routes protected
- ✅ Database: Proper indexes and constraints
- ✅ Logging: Uses NestJS Logger
- ✅ No console.log statements
- ✅ Follows existing code patterns

## Breaking Changes

None. All changes are additive.

## Deployment Notes

1. Run database migration:
   ```bash
   npx prisma migrate deploy
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Set environment variables:
   ```bash
   MIN_PAYOUT_AMOUNT=10
   ADMIN_EMAIL=admin@example.com
   ```

4. Restart the application

## Documentation

- `FEATURE_IMPLEMENTATION.md` - Detailed implementation guide
- `IMPLEMENTATION_COMPLETE.md` - Completion summary and checklist

## Related Issues

Closes #195
Closes #182
Closes #210
Closes #211

## Checklist

- [x] Code follows project style guidelines
- [x] Database migration created and tested
- [x] Environment variables documented
- [x] Security considerations addressed
- [x] Error handling implemented
- [x] Logging added
- [x] Documentation updated
- [x] No breaking changes
- [x] Ready for review

## Screenshots

### Queue Dashboard
Access at `/admin/queues` (admin only)
- Shows all three queues: clip-generation, clip-posting, payout-retry
- Real-time job statistics
- Job management interface

### Payout Request Response
```json
{
  "id": 123,
  "amount": 50.00,
  "currency": "USD",
  "method": "stellar",
  "status": "pending",
  "createdAt": "2026-06-01T12:00:00Z",
  "feeAmount": 2.50,
  "finalAmount": 47.50
}
```

## Reviewer Notes

- All four issues implemented in a single cohesive PR
- Database schema changes are backward compatible
- New dependencies are well-established libraries
- Admin authentication properly enforced
- Email notifications are configurable
- Cron job timing is production-ready (monthly)

## Next Steps After Merge

1. Monitor cron job execution on first of month
2. Monitor email notifications for failed jobs
3. Gather feedback on queue dashboard usability
4. Consider adding payout approval workflow
5. Add export functionality for monthly earnings
