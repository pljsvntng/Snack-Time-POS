export function databaseName(profile='') {
 if(!profile)return 'snack_time_offline';
 if(!/^demo_[a-z0-9_]{1,40}$/.test(profile))throw Error('Invalid local database profile. Existing app data was retained.');
 return 'snack_time_offline_'+profile;
}
export function assertDatabaseIdentity(actual,expected='') {
 if(expected&&actual!==expected)throw Error('This app is configured for a different POS database. Keep app data intact and use the matching application build.');
}
