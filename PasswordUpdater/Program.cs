namespace PasswordUpdater;

using System;
using System.Data;
using Microsoft.Data.SqlClient;

class Program
{
    static void Main(string[] args)
    {
        // Correct format for a BCrypt hash
        string correctHash = "$2a$11$YZ8qr4LHqNkPLculbtbRS.vVhyR3gvR73Bfb50HlxnWhcVl1ssThm";
        string password = "Admin123!";

        // Check if the hash is in the correct format
        Console.WriteLine($"Generated BCrypt hash: {correctHash}");
        Console.WriteLine($"First characters should be $2a$: {correctHash.StartsWith("$2a$")}");

        // Verify the password against the hash
        bool isValidPassword = BCrypt.Net.BCrypt.Verify(password, correctHash);
        Console.WriteLine($"Password verification result: {isValidPassword}");

        // Connect to the database and update the admin user's password
        string connectionString = "Server=DESKTOP-GU413U8;Database=ChattyWidgetDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;Encrypt=False";
        string selectQuery = "SELECT Email, PasswordHash FROM Users WHERE Email = 'testadmin@example.com'";

        try
        {
            using (SqlConnection connection = new SqlConnection(connectionString))
            {
                connection.Open();
                Console.WriteLine("Connected to database successfully");

                using (SqlCommand command = new SqlCommand(selectQuery, connection))
                {
                    using (SqlDataReader reader = command.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            string email = reader.GetString(0);
                            string storedHash = reader.GetString(1);
                            
                            Console.WriteLine($"Email: {email}");
                            Console.WriteLine($"Stored hash: {storedHash}");
                            Console.WriteLine($"Stored hash starts with $2a$: {storedHash.StartsWith("$2a$")}");
                            
                            // Try to verify with the stored hash
                            try
                            {
                                bool verifyResult = BCrypt.Net.BCrypt.Verify(password, storedHash);
                                Console.WriteLine($"Verification with stored hash: {verifyResult}");
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"Error verifying stored hash: {ex.Message}");
                            }
                        }
                    }
                }
                
                // Update the hash with the correct format
                string updateQuery = "UPDATE Users SET PasswordHash = @PasswordHash WHERE Email = 'testadmin@example.com'";
                using (SqlCommand command = new SqlCommand(updateQuery, connection))
                {
                    command.Parameters.Add("@PasswordHash", SqlDbType.NVarChar).Value = correctHash;
                    int rowsAffected = command.ExecuteNonQuery();
                    
                    Console.WriteLine($"Password updated successfully. Rows affected: {rowsAffected}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            Console.WriteLine(ex.StackTrace);
        }

        Console.WriteLine("Press any key to exit...");
        Console.ReadKey();
    }
}
