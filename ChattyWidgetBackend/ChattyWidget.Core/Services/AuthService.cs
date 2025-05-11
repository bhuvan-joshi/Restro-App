using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ChattyWidget.Models;
using Microsoft.IdentityModel.Tokens;

namespace ChattyWidget.Core.Services;

public class AuthService
{
    private readonly string _jwtSecret;
    private readonly string _jwtIssuer;
    private readonly string _jwtAudience;
    private readonly TimeSpan _tokenLifetime;

    public AuthService(string jwtSecret, string jwtIssuer, string jwtAudience, TimeSpan tokenLifetime)
    {
        _jwtSecret = jwtSecret;
        _jwtIssuer = jwtIssuer;
        _jwtAudience = jwtAudience;
        _tokenLifetime = tokenLifetime;
    }

    public string GenerateJwtToken(User user)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.ASCII.GetBytes(_jwtSecret);
        
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role)
        };
        
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.Add(_tokenLifetime),
            Issuer = _jwtIssuer,
            Audience = _jwtAudience,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key), 
                SecurityAlgorithms.HmacSha256Signature)
        };
        
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
    
    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }
    
    public bool VerifyPassword(string password, string hashedPassword)
    {
        // Check if it's a BCrypt hash (starts with $2a$)
        if (hashedPassword != null && hashedPassword.StartsWith("$2a$"))
        {
            return BCrypt.Net.BCrypt.Verify(password, hashedPassword);
        }
        
        // Legacy format (HMACSHA512): "salt:hash"
        try 
        {
            if (hashedPassword != null && hashedPassword.Contains(":"))
            {
                var parts = hashedPassword.Split(':');
                if (parts.Length == 2)
                {
                    var salt = Convert.FromBase64String(parts[0]);
                    var hash = Convert.FromBase64String(parts[1]);
                    
                    using (var hmac = new System.Security.Cryptography.HMACSHA512(salt))
                    {
                        var computedHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
                        for (int i = 0; i < computedHash.Length; i++)
                        {
                            if (computedHash[i] != hash[i]) return false;
                        }
                        return true;
                    }
                }
            }
            
            // If we got here, try BCrypt anyway as a last resort
            return BCrypt.Net.BCrypt.Verify(password, hashedPassword);
        }
        catch
        {
            return false;
        }
    }
} 