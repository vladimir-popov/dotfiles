------------------------------------------------------------
-- Sugar for Lua functions
------------------------------------------------------------
local M = { b = {} }

function M.map(mode, keys, action, opts)
  local options = { noremap = true }
  if opts then
    options = vim.tbl_extend("force", options, opts)
  end
  vim.api.nvim_set_keymap(mode, keys, action, options)
end
-- equivalent of nnoremap
function M.nmap(keys, action, opts)
  M.map('n', keys, action, opts)
end
-- equivalent of inoremap
function M.imap(keys, action, opts)
  M.map('i', keys, action, opts)
end
-- equivalent of vnoremap
function M.vmap(keys, action, opts)
  M.map('v', keys, action, opts)
end

function M.b.map(bufnr, mode, keys, action, opts)
  local options = { noremap = true }
  if opts then
    options = vim.tbl_extend("force", options, opts)
  end
  vim.api.nvim_buf_set_keymap(bufnr, mode, keys, action, options)
end
-- equivalent of nnoremap for buffer
function M.b.nmap(bufnr, keys, action, opts)
  M.b.map(bufnr, 'n', keys, action, opts)
end
-- equivalent of inoremap for buffer
function M.b.imap(bufnr, keys, action, opts)
  M.b.map(bufnr, 'i', keys, action, opts)
end
-- equivalent of vnoremap for buffer
function M.b.vmap(bufnr, keys, action, opts)
  M.b.map(bufnr, 'v', keys, action, opts)
end

function M.is_empty(x)
    if x == nil then
        return true
    end
    if type(x) == 'table' and next(x) == nil then
        return true
    end
    if type(x) == 'string' and string.len(x) < 1 then
        return true
    end
    return false
end

return M
