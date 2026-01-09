<template>
  <div class="max-w-7xl mx-auto p-4 sm:p-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          User Management
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage user accounts, roles, and permissions
        </p>
      </div>
      <div class="mt-4 sm:mt-0 flex gap-2 items-center">
        <Tag :value="`${pagination.total} Total Users`" severity="info" />
        <Button 
          label="Create User" 
          icon="pi pi-plus" 
          @click="openCreateDialog"
        />
      </div>
    </div>

    <!-- Filters & Search -->
    <Card class="mb-6">
      <template #content>
        <div class="flex flex-col md:flex-row gap-4">
          <!-- Search -->
          <div class="flex-1">
            <IconField>
              <InputIcon class="pi pi-search" />
              <InputText 
                v-model="searchQuery" 
                placeholder="Search by email or name..."
                class="w-full"
                @input="debouncedSearch"
              />
            </IconField>
          </div>
          
          <!-- Role Filter -->
          <Select 
            v-model="roleFilter" 
            :options="roleOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Filter by role"
            class="w-full md:w-48"
            @change="loadUsers"
          />
          
          <!-- Status Filter -->
          <Select 
            v-model="statusFilter" 
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Filter by status"
            class="w-full md:w-48"
            @change="loadUsers"
          />
        </div>
      </template>
    </Card>

    <!-- Loading State -->
    <div v-if="loading && !users.length" class="flex justify-center py-12">
      <i class="pi pi-spinner pi-spin text-4xl text-blue-500"></i>
    </div>

    <!-- Error State -->
    <Message v-if="error" severity="error" :closable="true" @close="clearError" class="mb-4">
      {{ error }}
    </Message>

    <!-- Success Message -->
    <Message v-if="successMessage" severity="success" :closable="true" @close="successMessage = ''" class="mb-4">
      {{ successMessage }}
    </Message>

    <!-- Users Table -->
    <Card v-if="users.length || !loading">
      <template #content>
        <DataTable 
          :value="users" 
          :loading="loading"
          responsiveLayout="scroll"
          class="p-datatable-sm"
        >
          <!-- User Column -->
          <Column header="User" style="min-width: 250px">
            <template #body="{ data }">
              <div class="flex items-center gap-3">
                <div class="relative">
                  <Avatar 
                    v-if="data.avatar_url"
                    :image="data.avatar_url" 
                    shape="circle"
                    size="large"
                  />
                  <div 
                    v-else
                    class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold"
                  >
                    {{ getUserInitials(data) }}
                  </div>
                  <span 
                    v-if="data.is_blocked"
                    class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                    title="Blocked"
                  >
                    <i class="pi pi-ban text-white text-xs"></i>
                  </span>
                </div>
                <div>
                  <div class="font-medium text-gray-900 dark:text-white">
                    {{ data.display_name }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    {{ data.email }}
                  </div>
                </div>
              </div>
            </template>
          </Column>

          <!-- Role Column -->
          <Column header="Role" style="min-width: 150px">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-1">
                <Tag :value="getRoleLabel(data.role)" :severity="getRoleSeverity(data.role)" />
                <Tag 
                  v-for="role in (data.additional_roles || []).slice(0, 2)" 
                  :key="role"
                  :value="role"
                  severity="secondary"
                  class="text-xs"
                />
                <Tag 
                  v-if="(data.additional_roles || []).length > 2"
                  :value="`+${data.additional_roles.length - 2}`"
                  severity="secondary"
                  class="text-xs"
                />
              </div>
            </template>
          </Column>

          <!-- Status Column -->
          <Column header="Status" style="min-width: 100px">
            <template #body="{ data }">
              <Tag 
                :value="data.is_blocked ? 'Blocked' : 'Active'" 
                :severity="data.is_blocked ? 'danger' : 'success'" 
              />
            </template>
          </Column>

          <!-- Last Login Column -->
          <Column header="Last Login" style="min-width: 150px">
            <template #body="{ data }">
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{ data.last_login ? formatDate(data.last_login) : 'Never' }}
              </span>
            </template>
          </Column>

          <!-- Actions Column -->
          <Column header="Actions" style="min-width: 200px">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button 
                  icon="pi pi-pencil" 
                  severity="secondary" 
                  text 
                  rounded
                  size="small"
                  title="Edit User"
                  :disabled="!canModifyUser(data)"
                  @click="openEditDialog(data)"
                />
                <Button 
                  icon="pi pi-id-card" 
                  severity="info" 
                  text 
                  rounded
                  size="small"
                  title="Manage Role"
                  :disabled="!canModifyUser(data)"
                  @click="openRoleDialog(data)"
                />
                <Button 
                  v-if="!data.is_blocked"
                  icon="pi pi-ban" 
                  severity="warning" 
                  text 
                  rounded
                  size="small"
                  title="Block User"
                  :disabled="!canModifyUser(data)"
                  @click="openBlockDialog(data)"
                />
                <Button 
                  v-else
                  icon="pi pi-check-circle" 
                  severity="success" 
                  text 
                  rounded
                  size="small"
                  title="Unblock User"
                  :disabled="!canModifyUser(data)"
                  @click="confirmUnblock(data)"
                />
                <Button 
                  icon="pi pi-key" 
                  severity="help" 
                  text 
                  rounded
                  size="small"
                  title="Reset Password"
                  :disabled="!canModifyUser(data)"
                  @click="openResetPasswordDialog(data)"
                />
                <Button 
                  icon="pi pi-trash" 
                  severity="danger" 
                  text 
                  rounded
                  size="small"
                  title="Delete User"
                  :disabled="!canModifyUser(data)"
                  @click="confirmDelete(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>

        <!-- Pagination -->
        <div v-if="pagination.totalPages > 1" class="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <span class="text-sm text-gray-600 dark:text-gray-400">
            Showing {{ (pagination.page - 1) * pagination.limit + 1 }} to {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }}
          </span>
          <div class="flex gap-2">
            <Button 
              icon="pi pi-chevron-left" 
              severity="secondary" 
              outlined
              size="small"
              :disabled="pagination.page <= 1"
              @click="changePage(pagination.page - 1)"
            />
            <Button 
              icon="pi pi-chevron-right" 
              severity="secondary" 
              outlined
              size="small"
              :disabled="pagination.page >= pagination.totalPages"
              @click="changePage(pagination.page + 1)"
            />
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="!users.length && !loading" class="text-center py-12">
          <i class="pi pi-users text-4xl text-gray-400 mb-4"></i>
          <p class="text-gray-600 dark:text-gray-400">No users found</p>
        </div>
      </template>
    </Card>

    <!-- ConfirmDialog - Required for useConfirm() -->
    <ConfirmDialog />

    <!-- Create User Dialog -->
    <Dialog 
      v-model:visible="createDialogVisible" 
      header="Create New User"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="space-y-4">
        <div class="field">
          <label class="block text-sm font-medium mb-1">Email <span class="text-red-500">*</span></label>
          <InputText v-model="createForm.email" class="w-full" placeholder="user@example.com" />
        </div>
        <div class="field">
          <label class="block text-sm font-medium mb-1">Display Name <span class="text-red-500">*</span></label>
          <InputText v-model="createForm.display_name" class="w-full" placeholder="John Doe" />
        </div>
        <div class="field">
          <label class="block text-sm font-medium mb-1">Password</label>
          <Password v-model="createForm.password" class="w-full" toggleMask placeholder="Leave empty to auto-generate" />
          <small class="text-gray-500">Leave empty to generate a random password</small>
        </div>
        <div class="field">
          <label class="block text-sm font-medium mb-1">Role</label>
          <Select 
            v-model="createForm.role" 
            :options="availableRoles"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="field">
          <label class="block text-sm font-medium mb-1">Language</label>
          <Select 
            v-model="createForm.language_preference" 
            :options="languageOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="field flex items-center gap-2">
          <Checkbox v-model="createForm.email_verified" :binary="true" inputId="create_email_verified" />
          <label for="create_email_verified">Mark email as verified</label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="createDialogVisible = false" />
        <Button label="Create User" @click="handleCreateUser" :loading="saving" />
      </template>
    </Dialog>

    <!-- Edit User Dialog -->
    <Dialog 
      v-model:visible="editDialogVisible" 
      header="Edit User"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="space-y-4" v-if="selectedUser">
        <div class="field">
          <label class="block text-sm font-medium mb-1">Display Name</label>
          <InputText v-model="editForm.display_name" class="w-full" />
        </div>
        <div class="field">
          <label class="block text-sm font-medium mb-1">Language</label>
          <Select 
            v-model="editForm.language_preference" 
            :options="languageOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="field flex items-center gap-2">
          <Checkbox v-model="editForm.email_verified" :binary="true" inputId="email_verified" />
          <label for="email_verified">Email Verified</label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="editDialogVisible = false" />
        <Button label="Save" @click="handleEditUser" :loading="saving" />
      </template>
    </Dialog>

    <!-- Role Management Dialog -->
    <Dialog 
      v-model:visible="roleDialogVisible" 
      header="Manage Role"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="space-y-4" v-if="selectedUser">
        <div class="field">
          <label class="block text-sm font-medium mb-1">Primary Role</label>
          <Select 
            v-model="roleForm.role" 
            :options="availableRoles"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="field">
          <label class="block text-sm font-medium mb-1">Additional Roles</label>
          <Chips v-model="roleForm.additional_roles" class="w-full" placeholder="Add role..." />
          <small class="text-gray-500">Press Enter to add custom roles</small>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="roleDialogVisible = false" />
        <Button label="Save" @click="handleUpdateRole" :loading="saving" />
      </template>
    </Dialog>

    <!-- Block User Dialog -->
    <Dialog 
      v-model:visible="blockDialogVisible" 
      header="Block User"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div v-if="selectedUser">
        <p class="mb-4">Are you sure you want to block <strong>{{ selectedUser.display_name }}</strong>?</p>
        <div class="field">
          <label class="block text-sm font-medium mb-1">Reason</label>
          <Textarea v-model="blockReason" rows="3" class="w-full" placeholder="Enter reason for blocking..." />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="blockDialogVisible = false" />
        <Button label="Block" severity="warning" @click="handleBlock" :loading="saving" />
      </template>
    </Dialog>

    <!-- Reset Password Dialog -->
    <Dialog 
      v-model:visible="resetPasswordDialogVisible" 
      header="Reset User Password"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div v-if="selectedUser">
        <p class="mb-4">Reset password for <strong>{{ selectedUser.display_name }}</strong> ({{ selectedUser.email }})</p>
        
        <div class="space-y-4">
          <div class="flex gap-4">
            <div class="flex items-center gap-2">
              <RadioButton v-model="resetPasswordMode" inputId="mode_generate" value="generate" />
              <label for="mode_generate">Generate random password</label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton v-model="resetPasswordMode" inputId="mode_set" value="set" />
              <label for="mode_set">Set specific password</label>
            </div>
          </div>
          
          <div v-if="resetPasswordMode === 'set'" class="field">
            <label class="block text-sm font-medium mb-1">New Password</label>
            <Password v-model="newPasswordValue" class="w-full" toggleMask />
          </div>
        </div>
        
        <!-- Show generated password -->
        <div v-if="generatedPassword" class="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p class="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
            Password has been reset! Share this securely with the user:
          </p>
          <div class="flex gap-2">
            <InputText :value="generatedPassword" readonly class="w-full font-mono" />
            <Button icon="pi pi-copy" severity="secondary" @click="copyPassword" title="Copy" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Close" severity="secondary" @click="closeResetPasswordDialog" />
        <Button 
          v-if="!generatedPassword"
          label="Reset Password" 
          severity="warning" 
          @click="handleResetPassword" 
          :loading="saving" 
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useUsers } from '@/composables/useUsers'
import { useAuth } from '@/composables/useAuth'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Avatar from 'primevue/avatar'
import Dialog from 'primevue/dialog'
import ConfirmDialog from 'primevue/confirmdialog'
import Checkbox from 'primevue/checkbox'
import Chips from 'primevue/chips'
import Password from 'primevue/password'
import RadioButton from 'primevue/radiobutton'
import Message from 'primevue/message'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'

const confirm = useConfirm()
const { user: currentUser } = useAuth()
const {
  users,
  pagination,
  loading,
  error,
  clearError,
  listUsers,
  createUser,
  updateUser,
  updateUserRole,
  blockUser,
  unblockUser,
  deleteUser,
  resetUserPassword,
  getUserInitials,
  getRoleLabel,
  getRoleLevel,
  canModifyRole,
  formatDate
} = useUsers()

// Local state
const searchQuery = ref('')
const roleFilter = ref(null)
const statusFilter = ref(null)
const saving = ref(false)
const successMessage = ref('')

// Dialog visibility
const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const roleDialogVisible = ref(false)
const blockDialogVisible = ref(false)
const resetPasswordDialogVisible = ref(false)

// Selected user and forms
const selectedUser = ref(null)
const createForm = ref({ 
  email: '', 
  display_name: '', 
  password: '', 
  role: 'user', 
  language_preference: 'en',
  email_verified: false 
})
const editForm = ref({ display_name: '', language_preference: 'en', email_verified: false })
const roleForm = ref({ role: 'user', additional_roles: [] })
const blockReason = ref('')
const resetPasswordMode = ref('generate')
const newPasswordValue = ref('')
const generatedPassword = ref('')

// Options
const roleOptions = [
  { label: 'All Roles', value: null },
  { label: 'Super Admin', value: 'superadmin' },
  { label: 'Admin', value: 'admin' },
  { label: 'User', value: 'user' }
]

const statusOptions = [
  { label: 'All Status', value: null },
  { label: 'Active', value: 'active' },
  { label: 'Blocked', value: 'blocked' }
]

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Français', value: 'fr' }
]

// Available roles based on current user's role
const availableRoles = computed(() => {
  const currentLevel = getRoleLevel(currentUser.value?.role)
  const roles = []
  
  // Can only assign roles lower than your own
  if (currentLevel > getRoleLevel('admin')) {
    roles.push({ label: 'Admin', value: 'admin' })
  }
  roles.push({ label: 'User', value: 'user' })
  
  return roles
})

// Check if current user can modify target user
const canModifyUser = (targetUser) => {
  if (!currentUser.value || !targetUser) return false
  if (targetUser.id === currentUser.value.id) return false // Can't modify self here
  return canModifyRole(currentUser.value.role, targetUser.role)
}

// Get role severity for Tag
const getRoleSeverity = (role) => {
  switch (role) {
    case 'superadmin': return 'danger'
    case 'admin': return 'warning'
    default: return 'info'
  }
}

// Debounced search
let searchTimeout = null
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadUsers()
  }, 300)
}

// Load users
const loadUsers = async () => {
  const params = {
    page: pagination.value.page,
    limit: pagination.value.limit,
    search: searchQuery.value || undefined,
    role: roleFilter.value || undefined,
    blocked: statusFilter.value === 'blocked' ? true : statusFilter.value === 'active' ? false : undefined
  }
  await listUsers(params)
}

// Change page
const changePage = (page) => {
  pagination.value.page = page
  loadUsers()
}

// Dialog handlers
const openCreateDialog = () => {
  createForm.value = { 
    email: '', 
    display_name: '', 
    password: '', 
    role: 'user', 
    language_preference: 'en',
    email_verified: false 
  }
  createDialogVisible.value = true
}

const openEditDialog = (user) => {
  selectedUser.value = user
  editForm.value = {
    display_name: user.display_name,
    language_preference: user.language_preference || 'en',
    email_verified: user.email_verified
  }
  editDialogVisible.value = true
}

const openRoleDialog = (user) => {
  selectedUser.value = user
  roleForm.value = {
    role: user.role,
    additional_roles: [...(user.additional_roles || [])]
  }
  roleDialogVisible.value = true
}

const openBlockDialog = (user) => {
  selectedUser.value = user
  blockReason.value = ''
  blockDialogVisible.value = true
}

const openResetPasswordDialog = (user) => {
  selectedUser.value = user
  resetPasswordMode.value = 'generate'
  newPasswordValue.value = ''
  generatedPassword.value = ''
  resetPasswordDialogVisible.value = true
}

const closeResetPasswordDialog = () => {
  resetPasswordDialogVisible.value = false
  generatedPassword.value = ''
}

// Confirm dialogs using useConfirm
const confirmDelete = (user) => {
  confirm.require({
    message: `Are you sure you want to delete ${user.display_name}? This action cannot be undone.`,
    header: 'Delete User',
    icon: 'pi pi-exclamation-triangle',
    rejectClass: 'p-button-secondary p-button-outlined',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Delete',
    accept: async () => {
      saving.value = true
      try {
        await deleteUser(user.id)
        successMessage.value = 'User deleted successfully'
        loadUsers()
      } catch (err) {
        console.error('Failed to delete user:', err)
      } finally {
        saving.value = false
      }
    }
  })
}

const confirmUnblock = (user) => {
  confirm.require({
    message: `Are you sure you want to unblock ${user.display_name}?`,
    header: 'Unblock User',
    icon: 'pi pi-question-circle',
    rejectClass: 'p-button-secondary p-button-outlined',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-success',
    acceptLabel: 'Unblock',
    accept: async () => {
      saving.value = true
      try {
        await unblockUser(user.id)
        successMessage.value = 'User unblocked successfully'
        loadUsers()
      } catch (err) {
        console.error('Failed to unblock user:', err)
      } finally {
        saving.value = false
      }
    }
  })
}

// Action handlers
const handleCreateUser = async () => {
  if (!createForm.value.email || !createForm.value.display_name) {
    return
  }
  saving.value = true
  try {
    const result = await createUser(createForm.value)
    
    // Show the temporary password if one was generated
    if (result.temporaryPassword) {
      successMessage.value = `User created! Temporary password: ${result.temporaryPassword}`
    } else {
      successMessage.value = 'User created successfully'
    }
    
    createDialogVisible.value = false
    loadUsers()
  } catch (err) {
    console.error('Failed to create user:', err)
  } finally {
    saving.value = false
  }
}

const handleEditUser = async () => {
  if (!selectedUser.value) return
  saving.value = true
  try {
    await updateUser(selectedUser.value.id, editForm.value)
    successMessage.value = 'User updated successfully'
    editDialogVisible.value = false
    loadUsers()
  } catch (err) {
    console.error('Failed to update user:', err)
  } finally {
    saving.value = false
  }
}

const handleUpdateRole = async () => {
  if (!selectedUser.value) return
  saving.value = true
  try {
    await updateUserRole(selectedUser.value.id, roleForm.value)
    successMessage.value = 'Role updated successfully'
    roleDialogVisible.value = false
    loadUsers()
  } catch (err) {
    console.error('Failed to update role:', err)
  } finally {
    saving.value = false
  }
}

const handleBlock = async () => {
  if (!selectedUser.value) return
  saving.value = true
  try {
    await blockUser(selectedUser.value.id, blockReason.value)
    successMessage.value = 'User blocked successfully'
    blockDialogVisible.value = false
    loadUsers()
  } catch (err) {
    console.error('Failed to block user:', err)
  } finally {
    saving.value = false
  }
}

const handleResetPassword = async () => {
  if (!selectedUser.value) return
  saving.value = true
  try {
    const password = resetPasswordMode.value === 'set' ? newPasswordValue.value : null
    const result = await resetUserPassword(selectedUser.value.id, password)
    generatedPassword.value = result.temporaryPassword
    successMessage.value = 'Password reset successfully'
  } catch (err) {
    console.error('Failed to reset password:', err)
  } finally {
    saving.value = false
  }
}

const copyPassword = async () => {
  if (generatedPassword.value) {
    try {
      await navigator.clipboard.writeText(generatedPassword.value)
      successMessage.value = 'Password copied to clipboard'
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }
}

// Load users on mount
onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
:deep(.p-card) {
  @apply bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700;
}

:deep(.p-datatable) {
  @apply bg-transparent;
}

:deep(.p-datatable .p-datatable-header) {
  @apply bg-transparent border-0;
}

:deep(.p-datatable .p-datatable-thead > tr > th) {
  @apply bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600;
}

:deep(.p-datatable .p-datatable-tbody > tr) {
  @apply bg-white dark:bg-slate-800;
}

:deep(.p-datatable .p-datatable-tbody > tr > td) {
  @apply border-gray-200 dark:border-slate-700;
}

:deep(.p-dialog) {
  @apply bg-white dark:bg-slate-800;
}

:deep(.p-dialog .p-dialog-header) {
  @apply bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-b border-gray-200 dark:border-slate-700;
}

:deep(.p-dialog .p-dialog-content) {
  @apply bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300;
}

:deep(.p-dialog .p-dialog-footer) {
  @apply bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700;
}

:deep(.p-inputtext),
:deep(.p-select),
:deep(.p-textarea),
:deep(.p-chips),
:deep(.p-password input) {
  @apply bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600;
}

:deep(.p-password) {
  @apply w-full;
}
</style>