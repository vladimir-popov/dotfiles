local M = {}

---@type Component
M.diagnostic_errors = {
    provider = 'diagnostic_errors',
    hl = { fg = 'red' },
}

---@type Component
M.diagnostic_warnings = {
    provider = 'diagnostic_warnings',
    hl = { fg = 'orange' },
}

---@type Component
M.diagnostic_info = {
    provider = 'diagnostic_info',
    hl = { fg = 'blue' },
}

---@type Component
M.diagnostic_hint = {
    provider = 'diagnostic_hint',
    hl = { fg = 'purple' },
}

return M
