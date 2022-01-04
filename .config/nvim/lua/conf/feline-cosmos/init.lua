local M = {}

local vi_mode = require('feline.providers.vi_mode')
local icons = require('nvim-web-devicons').get_icons()

vim.cmd('augroup git_status')
vim.cmd('autocmd!')
vim.cmd(
    'autocmd BufEnter,FocusGained,BufWritePost * let b:git_status = systemlist("git status --porcelain")'
)
vim.cmd('augroup end')

local function is_empty(x)
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

local function is_table(t)
    return type(t) == 'table'
end

local function lsp_client()
    local clients = vim.lsp.buf_get_clients(0)
    if is_empty(clients) then
        return nil
    end
    local _, client = next(clients)
    return client
end

local function lsp_client_icon(client)
    if client == nil then
        return nil
    end
    local icon = icons.default

    for _, ft in ipairs(client.config.filetypes) do
        if icons[ft] ~= nil then
            icon = icons[ft]
            break
        end
    end
    return icon
end

-- {mode} - 'keep', 'override', 'error'(default)
local function merge(mode, t1, t2)
    if not (is_table(t1) and is_table(t2)) then
        if t1 == t2 or mode == 'keep' or t2 == nil then
            return t1
        end
        if mode == 'override' or t1 == nil then
            return t2
        end
        -- neither t1 or t2 is not nil and their not equal
        return error(string.format('%s is not equal to %s', t1, t2))
    end

    for k, v in pairs(t2) do
        t1[k] = merge(mode, t1[k], v)
    end

    return t1
end

M.providers = {
    file_name = function()
        return vim.fn.expand('%:t')
    end,

    relative_file_name = function()
        local full_name = vim.fn.expand('%:p')
        local name = vim.fn.expand('%:.')
        if name == full_name then
            name = vim.fn.expand('%:~')
        end
        if name == full_name then
            name = '/../' .. vim.fn.expand('%:t')
        end
        return name
    end,

    filetype = function()
        return vim.bo.filetype
    end,

    working_directory = function()
        local full_path = vim.fn.getcwd()
        local dir = vim.fn.fnamemodify(full_path, ':t')
        local parent = vim.fn.fnamemodify(full_path, ':h:t')
        if is_empty(dir) then
            dir = full_path
        end
        if is_empty(parent) then
            dir = full_path
        else
            dir = '../' .. parent .. '/' .. dir
        end
        return dir .. '/'
    end,

    lsp_client_icon = function()
        local icon = lsp_client_icon(lsp_client())
        if icon == nil then
            return 'ﮤ'
        else
            return icon.icon
        end
    end,

    spellcheck = function()
        local icon = '暈'
        if vim.wo.spell then
            return vim.bo.spelllang, icon
        else
            return icon
        end
    end,

    fugitive_branch = function()
        if M.conditions.is_git_workspace() then
            return vim.fn.FugitiveHead(), '  '
        else
            return '  '
        end
    end,

    fugitive_git_dir = function()
        return vim.fn.FugitiveGitDir()
    end,
}

M.conditions = {
    is_buffer_not_empty = function()
        return vim.fn.empty(vim.fn.expand('%:t')) ~= 1
    end,

    is_git_workspace = function()
        return not is_empty(M.providers.fugitive_git_dir())
    end,

    is_git_changed = function()
        return (vim.b.git_status and next(vim.b.git_status)) ~= nil
    end,
}

M.highlights = function()
    return {
        git_status = function()
            if not M.conditions.is_git_workspace() then
                return { name = 'GitInactive', fg = 'inactive' }
            end
            if M.conditions.is_git_changed() then
                return { name = 'GitUncommited', fg = 'warn' }
            else
                return { name = 'GitCommited', fg = 'ok' }
            end
        end,

        lsp_client = function()
            local client = lsp_client()
            local icon = lsp_client_icon(client)
            local color = (icon and icon.color) or (icon and 'fg') or 'inactive'
            return {
                name = 'LspClientIcon' .. ((client and client.name) or 'Off'),
                fg = color,
            }
        end,

        treesitter = function()
            local ok, _ = pcall(vim.treesitter.get_parser, 0)
            if ok then
                return { name = 'TreesitterActive', fg = 'green' }
            else
                return { name = 'TreesitterInactive', fg = 'inactive' }
            end
        end,

        spellcheck = function()
            if vim.wo.spell then
                return { name = 'SpellcheckActive', fg = 'fg' }
            else
                return { name = 'SpellcheckInactive', fg = 'inactive' }
            end
        end,

        vi_mode = function()
            return {
                name = vi_mode.get_mode_highlight_name(),
                fg = vi_mode.get_mode_color(),
            }
        end,
    }
end

M.components = function()
    return {

        file_name = {
            provider = M.providers.relative_file_name,
            short_provider = M.providers.file_name,
            enabled = M.conditions.is_buffer_not_empty,
        },

        filetype = {
            provider = M.providers.filetype,
        },

        git_branch = {
            provider = M.providers.fugitive_branch,
            hl = M.highlights().git_status,
            truncate_hide = true,
        },

        lsp_client_icon = {
            provider = M.providers.lsp_client_icon,
            hl = M.highlights().lsp_client,
            truncate_hide = true,
        },

        lsp_warnings = {
            provider = 'diagnostic_warnings',
            hl = 'NvimTreeLspDiagnosticsWarning',
            truncate_hide = true,
        },

        lsp_errors = {
            provider = 'diagnostic_errors',
            hl = 'NvimTreeLspDiagnosticsError',
            truncate_hide = true,
        },

        metals_status = {
            provider = function()
                return (vim.g['metals_status'] or '')
            end,
        },

        scroll_bar = {
            provider = 'scroll_bar',
            hl = M.highlights().vi_mode,
        },

        spellcheck = {
            provider = M.providers.spellcheck,
            hl = M.highlights().spellcheck,
            truncate_hide = true,
        },

        treesitter_icon = {
            provider = '  ',
            hl = M.highlights().treesitter,
            truncate_hide = true,
        },

        vi_mode_bar = {
            provider = '▊',
            hl = M.highlights().vi_mode,
        },

        working_directory = {
            provider = M.providers.working_directory,
            hl = M.highlights().vi_mode,
            truncate_hide = true,
        },
    }
end

M.build = function(active, inactive, components)
    local transform = function(line)
        for i, cs in ipairs(line) do
            for k, c in pairs(cs) do
                if c.component then
                    local c1 = assert(
                        components[c.component],
                        'Component ' .. c.component .. ' not found'
                    )
                    line[i][k] = merge('error', c, c1)
                end
            end
        end
        return line
    end

    return {
        active = transform(active),
        inactive = transform(inactive),
    }
end

M.preset = function()
    local sep = { str = ' | ', hl = { fg = 'sep' } }

    local active_left = {
        { component = 'vi_mode_bar' },
        { component = 'working_directory' },
        { component = 'file_name', hl = { fg = 'white' } },
        { provider = ' ', hl = { fg = 'bg', bg = 'NONE' } },
    }

    local active_middle = {
        { component = 'metals_status', hl = { fg = 'inactive', bg = 'NONE' } },
    }

    local active_right = {
        { provider = ' ', hl = { fg = 'bg', bg = 'NONE' } },
        { component = 'lsp_warnings' },
        { component = 'lsp_errors', right_sep = sep },
        { component = 'git_branch', right_sep = sep },
        { component = 'spellcheck', right_sep = sep },
        { component = 'lsp_client_icon' },
        { component = 'treesitter_icon', right_sep = sep },
        { provider = 'position', hl = { fg = 'Identifier' }, right_sep = sep },
        { component = 'scroll_bar' },
    }

    local inactive_left = {
        { component = 'file_name' },
    }

    local active = { active_left, active_middle, active_right }
    local inactive = { inactive_left }

    return M.build(active, inactive, M.components())
end

return M
