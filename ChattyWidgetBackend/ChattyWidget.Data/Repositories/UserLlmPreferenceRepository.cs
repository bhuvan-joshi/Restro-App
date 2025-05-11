using ChattyWidget.Core.Interfaces;
using ChattyWidget.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace ChattyWidget.Data.Repositories
{
    public class UserLlmPreferenceRepository : IUserLlmPreferenceRepository
    {
        private readonly ApplicationDbContext _context;

        public UserLlmPreferenceRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<UserLlmPreference> GetByUserIdAsync(Guid userId)
        {
            var preferences = await _context.UserLlmPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId);

            // If no preferences exist yet, return default preferences
            if (preferences == null)
            {
                return new UserLlmPreference
                {
                    UserId = userId,
                    PreferredModelId = "llama3.2:latest", // Default free model
                    Temperature = 0.7,
                    MaxTokens = 800,
                    EnableStreaming = false,
                    LastUpdated = DateTime.UtcNow
                };
            }

            return preferences;
        }

        public async Task<bool> HasPreferencesAsync(Guid userId)
        {
            return await _context.UserLlmPreferences.AnyAsync(p => p.UserId == userId);
        }

        public async Task CreatePreferencesAsync(UserLlmPreference preferences)
        {
            await _context.UserLlmPreferences.AddAsync(preferences);
        }

        public Task UpdatePreferencesAsync(UserLlmPreference preferences)
        {
            preferences.LastUpdated = DateTime.UtcNow;
            _context.UserLlmPreferences.Update(preferences);
            return Task.CompletedTask;
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
    }
}
