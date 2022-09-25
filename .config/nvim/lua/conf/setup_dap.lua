local dap = require('dap')
local u = require('utils')

-- Change BP icon
vim.fn.sign_define('DapBreakpoint', { text = '', texthl = '', linehl = '', numhl = '' })

-- Setup keymaps
u.nmap('<F6>', '<cmd>lua require"dap".continue(); print("dap.continue")<CR>')
-- Shift + F6
u.nmap('<F18>', '<cmd>lua require"dap".run_last()<CR>')
u.nmap('<F7>', '<cmd>lua require"dap".step_into()<CR>')
u.nmap('<F8>', '<cmd>lua require"dap".step_over()<CR>')
-- Shift + F8
u.nmap('<F20>', '<cmd>lua require"dap".step_out()<CR>')
-- Ctrl + F12
u.nmap('<F36>', '<cmd>lua require"dap".stop()<CR>')
u.nmap('<space>dr', '<cmd>lua require"dap".repl.toggle()<CR>')
u.nmap('<space>ds', '<cmd>lua require"dap.ui.variables").scopes()<CR>')
u.nmap('<space>db', '<cmd>lua require"dap".toggle_breakpoint()<CR>')
u.nmap(
    '<space>dB',
    '<cmd>lua require"dap".set_breakpoint(vim.fn.input("Breakpoint condition: "))<CR>'
)

-- LUA ---------------------------------------------------------------
---@see https://github.com/jbyuki/one-small-step-for-vimkind#configuration

dap.configurations.lua = {
    {
        type = 'nlua',
        request = 'attach',
        name = 'Attach to running Neovim instance',
    },
}

dap.adapters.nlua = function(callback, config)
    callback({ type = 'server', host = config.host or '127.0.0.1', port = config.port or 8086 })
end
----------------------------------------------------------------------
