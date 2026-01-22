# User Management (Frontend)

## What it is

The user management composable (`useUsers`) provides functionality for profile management (self) and admin user operations including CRUD, role management, blocking, and password reset.

## Where it lives (code map)

- **`frontend/src/composables/useUsers.js`** - User management composable
- **`frontend/src/views/UsersView.vue`** - Admin user management UI
- **`frontend/src/views/ProfileView.vue`** - User profile UI

## How it works

### Profile Operations

Users can manage their own profile:
- View/update profile
- Change password
- Delete account

### Admin Operations

Admins can manage users:
- List users with pagination, search, filtering
- Create/update/delete users
- Manage roles
- Block/unblock users
- Reset passwords
- View audit logs

## How to use it

### Profile Management

```javascript
import { useUsers } from '@/composables/useUsers'

const {
  currentUser,
  getProfile,
  updateProfile,
  changePassword,
  deleteOwnAccount
} = useUsers()

// Get profile
const user = await getProfile()

// Update profile
await updateProfile({
  display_name: 'Jane Doe',
  avatar_url: 'https://example.com/avatar.jpg',
  language_preference: 'fr'
})

// Change password
await changePassword({
  currentPassword: 'OldPass123!',
  newPassword: 'NewPass456!',
  confirmPassword: 'NewPass456!'
})

// Delete account
await deleteOwnAccount()
```

### Admin Operations

```javascript
const {
  users,
  pagination,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  blockUser,
  updateUserRole
} = useUsers()

// List users
await listUsers({
  page: 1,
  limit: 20,
  search: 'john',
  role: 'user',
  blocked: false
})

// Create user
const result = await createUser({
  email: 'newuser@example.com',
  display_name: 'New User',
  role: 'user'
})
console.log(result.temporaryPassword)  // If auto-generated

// Update user
await updateUser(userId, {
  display_name: 'Updated Name'
})

// Update role
await updateUserRole(userId, {
  role: 'admin',
  additional_roles: ['moderator']
})

// Block user
await blockUser(userId, 'Violation of terms')

// Unblock user
await unblockUser(userId)

// Delete user
await deleteUser(userId)
```

### Role Helpers

```javascript
const {
  getRoleColor,
  getRoleLabel,
  getRoleLevel,
  canModifyRole,
  VALID_ROLES,
  ROLE_COLORS
} = useUsers()

// Get role display
const colorClass = getRoleColor('admin')
const label = getRoleLabel('admin')
const level = getRoleLevel('admin')

// Check permissions
const canModify = canModifyRole('admin', 'user')  // true
```

## Configuration

No configuration required. Uses API endpoints from [User Management](../backend/docs/user-management.md).

## Extending / modifying

### Custom User Fields

```javascript
// In useUsers.js
const updateCustomField = async (userId, value) => {
  return updateUser(userId, { custom_field: value })
}
```

### Custom Role Colors

```javascript
// In useUsers.js
const ROLE_COLORS = {
  superadmin: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  user: 'bg-gray-100 text-gray-800',
  custom: 'bg-green-100 text-green-800'  // Add custom
}
```

## Troubleshooting

### Users not loading

- **Check permissions**: Ensure user has admin role
- **Check API**: Ensure `/api/v1/users` endpoint is accessible
- **Check filters**: Ensure filter parameters are correct

### Role update fails

- **Check hierarchy**: Ensure actor has higher role than target
- **Check self-modification**: Cannot modify own role
- **Check permissions**: Ensure user has admin role

## Security considerations

1. **Client-Side Only**: UI checks are client-side (server enforces permissions)
2. **Role Validation**: Server validates all role changes
3. **Input Validation**: Validate all user input before sending to API

## Related docs

- [User Management](../backend/docs/user-management.md) - Server-side user management
- [Authentication](./authentication.md) - User authentication
