# ApparelFlow Evaluation Guide

This guide mirrors the challenge's five-minute technical audit. Run the application first:

```powershell
npm install
npm run build
$env:JWT_SECRET='replace-with-at-least-32-characters'
npm start
```

The API examples below assume `http://localhost:3000`. They use separate cookie sessions so that role isolation is exercised rather than bypassed.

## 1. Create a batch as Cutting Supervisor

```powershell
$base = 'http://localhost:3000'
$supervisor = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ email='supervisor@apparelflow.demo'; password='Demo123!' } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -WebSession $supervisor -ContentType 'application/json' -Body $loginBody

$recipes = Invoke-RestMethod -Uri "$base/api/recipes" -WebSession $supervisor
$blouse = $recipes | Where-Object recipe_code -eq 'REC-BL01'
$orderBody = @{
  recipeId = $blouse.id
  targetQty = 10
  fabricRollId = 'FAB-AUDIT-001'
  actualFabricYds = 18.5
} | ConvertTo-Json
$created = Invoke-RestMethod -Uri "$base/api/orders" -Method Post -WebSession $supervisor -ContentType 'application/json' -Body $orderBody
$orderId = $created.order.id
$submitted = Invoke-RestMethod -Uri "$base/api/orders/$orderId/submit" -Method Post -WebSession $supervisor -ContentType 'application/json' -Body '{}'
$orderId
```

## 2. Prove that a supervisor cannot approve

This must return HTTP 403.

```powershell
try {
  Invoke-RestMethod -Uri "$base/api/orders/$orderId/approve" -Method Post -WebSession $supervisor -ContentType 'application/json' -Body '{}'
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

## 3. Enter a shortage and prove the hard stop

```powershell
$verifier = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$verifierLogin = @{ email='verifier@apparelflow.demo'; password='Demo123!' } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -WebSession $verifier -ContentType 'application/json' -Body $verifierLogin

$detail = Invoke-RestMethod -Uri "$base/api/orders/$orderId" -WebSession $verifier
$counts = @($detail.items | ForEach-Object {
  @{ componentId=$_.component_id; actualQty=$_.expected_qty }
})
$counts[0].actualQty = $counts[0].actualQty - 1
$countBody = @{ items=$counts } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Uri "$base/api/orders/$orderId/counts" -Method Put -WebSession $verifier -ContentType 'application/json' -Body $countBody

try {
  Invoke-RestMethod -Uri "$base/api/orders/$orderId/approve" -Method Post -WebSession $verifier -ContentType 'application/json' -Body '{}'
} catch {
  $_.Exception.Response.StatusCode.value__  # expected: 422
}
```

## 4. Prove that a rejection reason is mandatory

```powershell
try {
  Invoke-RestMethod -Uri "$base/api/orders/$orderId/reject" -Method Post -WebSession $verifier -ContentType 'application/json' -Body '{"reason":""}'
} catch {
  $_.Exception.Response.StatusCode.value__  # expected: 422
}
```

Use a real reason to complete the rejection:

```powershell
$rejectBody = @{ reason='Front panel shortage found during physical count.' } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/api/orders/$orderId/reject" -Method Post -WebSession $verifier -ContentType 'application/json' -Body $rejectBody
```

## 5. Create and approve an all-green batch

Run the create-batch block again to get a new `$orderId`, then:

```powershell
$detail = Invoke-RestMethod -Uri "$base/api/orders/$orderId" -WebSession $verifier
$greenCounts = @($detail.items | ForEach-Object {
  @{ componentId=$_.component_id; actualQty=$_.expected_qty }
})
$greenBody = @{ items=$greenCounts } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Uri "$base/api/orders/$orderId/counts" -Method Put -WebSession $verifier -ContentType 'application/json' -Body $greenBody
Invoke-RestMethod -Uri "$base/api/orders/$orderId/approve" -Method Post -WebSession $verifier -ContentType 'application/json' -Body '{}'
```

## 6. Inspect the isolated sewing queue

```powershell
$sewing = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$sewingLogin = @{ email='sewing@apparelflow.demo'; password='Demo123!' } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -WebSession $sewing -ContentType 'application/json' -Body $sewingLogin
$queue = Invoke-RestMethod -Uri "$base/api/sewing/queue" -WebSession $sewing
$queue | Format-Table order_no, recipe_name, status, verifier_name, wastage_pct
```

Only `VERIFIED` or already-started `SEWING` batches may appear.

## Useful PostgreSQL queries

Run these in the Neon SQL Editor or any PostgreSQL client connected through `DATABASE_URL`.

```sql
-- Full order state overview
SELECT o.order_no, r.recipe_code, o.target_qty, o.status,
       u.full_name AS created_by, o.created_at
FROM cutting_orders o
JOIN recipes r ON r.id = o.recipe_id
JOIN users u ON u.id = o.created_by
ORDER BY o.created_at DESC;

-- Component variances and traffic-light result
SELECT o.order_no, rc.component_name, vi.expected_qty, vi.actual_qty,
       vi.actual_qty - vi.expected_qty AS variance, vi.status
FROM verification_items vi
JOIN cutting_orders o ON o.id = vi.order_id
JOIN recipe_components rc ON rc.id = vi.component_id
ORDER BY o.id DESC, vi.id;

-- Immutable verification history
SELECT o.order_no, l.decision, u.full_name AS verifier,
       l.rejection_note, l.wastage_pct, l.timestamp,
       l.component_variances
FROM verification_logs l
JOIN cutting_orders o ON o.id = l.order_id
JOIN users u ON u.id = l.verifier_id
ORDER BY l.timestamp DESC;

-- Prove that no shortage was approved
SELECT DISTINCT o.order_no
FROM cutting_orders o
JOIN verification_logs l ON l.order_id = o.id AND l.decision = 'APPROVED'
JOIN verification_items vi ON vi.order_id = o.id
WHERE vi.status = 'RED' OR vi.actual_qty IS NULL;

-- This query must return zero rows.

-- Exact verified release-queue isolation predicate
SELECT order_no, status
FROM cutting_orders
WHERE status = 'VERIFIED';
```

## Automated checks

```powershell
npm test
npm run build
```

The test suite covers the five mandatory domain/security cases from the assessment.
