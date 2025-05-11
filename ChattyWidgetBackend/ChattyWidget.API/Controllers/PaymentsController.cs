using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ChattyWidget.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(ILogger<PaymentsController> logger)
    {
        _logger = logger;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedAccessException("User is not authenticated");
        }
        return userId;
    }
    
    [Authorize]
    [HttpPost("stripe/create-session")]
    public async Task<ActionResult<object>> CreateStripeSession([FromBody] StripeSessionRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            
            // In a real implementation, you would:
            // 1. Validate the request
            // 2. Create a checkout session with the Stripe API
            // 3. Store the session information in your database
            // 4. Return the session ID to the client
            
            // For demo purposes, we'll return a mock session ID
            await Task.Delay(100); // Simulate API call
            
            return Ok(new { 
                sessionId = $"cs_test_{Guid.NewGuid().ToString("N")}" 
            });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating Stripe session");
            return StatusCode(500, new { error = "Failed to create Stripe session" });
        }
    }
    
    [Authorize]
    [HttpPost("paypal/create-order")]
    public async Task<ActionResult<object>> CreatePayPalOrder([FromBody] PayPalOrderRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            
            // In a real implementation, you would:
            // 1. Validate the request
            // 2. Create an order with the PayPal API
            // 3. Store the order information in your database
            // 4. Return the order ID and approval URL to the client
            
            // For demo purposes, we'll return mock data
            await Task.Delay(100); // Simulate API call
            
            var orderId = $"ORD_{Guid.NewGuid().ToString("N")}";
            var successUrl = request.SuccessUrl ?? $"{Request.Scheme}://{Request.Host}/payment-success";
            
            return Ok(new { 
                orderID = orderId,
                approvalUrl = $"https://www.sandbox.paypal.com/checkoutnow?token={orderId}" 
            });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating PayPal order");
            return StatusCode(500, new { error = "Failed to create PayPal order" });
        }
    }
    
    [Authorize]
    [HttpPost("paypal/capture-order")]
    public async Task<ActionResult<object>> CapturePayPalOrder([FromBody] CaptureOrderRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            
            // In a real implementation, you would:
            // 1. Validate the request
            // 2. Capture the payment with the PayPal API
            // 3. Update the order status in your database
            // 4. Return the transaction details to the client
            
            // For demo purposes, we'll return mock data
            await Task.Delay(100); // Simulate API call
            
            return Ok(new { 
                transactionId = $"TRANS_{Guid.NewGuid().ToString("N")}",
                status = "COMPLETED"
            });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error capturing PayPal order");
            return StatusCode(500, new { error = "Failed to capture PayPal order" });
        }
    }
    
    [Authorize]
    [HttpPost("cancel-subscription")]
    public async Task<ActionResult> CancelSubscription()
    {
        try
        {
            var userId = GetCurrentUserId();
            
            // In a real implementation, you would:
            // 1. Find the user's active subscription
            // 2. Cancel it with the payment provider (Stripe/PayPal)
            // 3. Update the subscription status in your database
            
            // For demo purposes, we'll just wait a bit
            await Task.Delay(500); // Simulate API call
            
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling subscription");
            return StatusCode(500, new { error = "Failed to cancel subscription" });
        }
    }
    
    [Authorize]
    [HttpPost("update-payment-info")]
    public async Task<ActionResult<object>> UpdatePaymentInfo()
    {
        try
        {
            var userId = GetCurrentUserId();
            
            // In a real implementation, you would:
            // 1. Create a customer portal session with Stripe
            // 2. Return the URL to redirect the customer to
            
            // For demo purposes, we'll return a mock URL
            await Task.Delay(100); // Simulate API call
            
            return Ok(new { 
                redirectUrl = "https://billing.stripe.com/p/demo/customer_portal"
            });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating payment info");
            return StatusCode(500, new { error = "Failed to update payment information" });
        }
    }
    
    [Authorize]
    [HttpGet("subscription-status")]
    public async Task<ActionResult<object>> GetSubscriptionStatus()
    {
        try
        {
            var userId = GetCurrentUserId();
            
            // In a real implementation, you would:
            // 1. Find the user's active subscription
            // 2. Return the details
            
            // For demo purposes, we'll return mock data
            await Task.Delay(100); // Simulate API call
            
            return Ok(new { 
                planId = "basic",
                status = "active",
                currentPeriodEnd = DateTime.UtcNow.AddMonths(1),
                cancelAtPeriodEnd = false
            });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting subscription status");
            return StatusCode(500, new { error = "Failed to get subscription status" });
        }
    }
}

// Request models
public class StripeSessionRequest
{
    public string PlanId { get; set; }
    public decimal Amount { get; set; }
    public string SuccessUrl { get; set; }
    public string CancelUrl { get; set; }
}

public class PayPalOrderRequest
{
    public string PlanId { get; set; }
    public decimal Amount { get; set; }
    public string SuccessUrl { get; set; }
    public string CancelUrl { get; set; }
}

public class CaptureOrderRequest
{
    public string OrderId { get; set; }
} 