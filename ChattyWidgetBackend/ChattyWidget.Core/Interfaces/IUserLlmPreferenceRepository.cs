using ChattyWidget.Models;
using System;
using System.Threading.Tasks;

namespace ChattyWidget.Core.Interfaces
{
    public interface IUserLlmPreferenceRepository
    {
        Task<UserLlmPreference> GetByUserIdAsync(Guid userId);
        Task<bool> HasPreferencesAsync(Guid userId);
        Task CreatePreferencesAsync(UserLlmPreference preferences);
        Task UpdatePreferencesAsync(UserLlmPreference preferences);
        Task SaveChangesAsync();
    }
}
