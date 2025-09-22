local colors = {
    fg = '#abb2bf',
    bg = '#3c3c41',
    alpha = 'NONE',
    inactive = '#5c6370',
    insert = '#79a15c',
    command = '#e5c07b',
    visual = '#c678dd',
    normal = '#61afef',
    replace = '#d3869b',
}

local cosmos_dark = {
    normal = {
        a = { bg = colors.bg, fg = colors.normal },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },
        x = { bg = colors.alpha, fg = 'green' },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.normal },
    },
    insert = {
        a = { bg = colors.bg, fg = colors.insert },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },
        x = { bg = colors.alpha, fg = colors.inactive },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.insert },
    },
    visual = {
        a = { bg = colors.bg, fg = colors.visual },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },
        x = { bg = colors.alpha, fg = colors.inactive },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.visual },
    },
    replace = {
        a = { bg = colors.bg, fg = colors.replace },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },
        x = { bg = colors.alpha, fg = colors.inactive },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.replace },
    },
    command = {
        a = { bg = colors.bg, fg = colors.command },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },
        x = { bg = colors.alpha, fg = colors.inactive },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.command },
    },
    inactive = {
        a = { bg = colors.bg, fg = colors.inactive },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },
        x = { bg = colors.alpha, fg = colors.inactive },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.inactive },
    },
}

local function icon_only(opts)
    return vim.tbl_extend('keep', {
        '%{""}',
        draw_empty = true,
        separator = '',
        padding = { left = 1, right = 0 },
    }, opts)
end

function lsp_status()
    return require('lualine.utils.utils').stl_escape(vim.lsp.status())
end

return {
    'nvim-lualine/lualine.nvim',
    event = 'VeryLazy',
    dependencies = {
        'nvim-tree/nvim-web-devicons',
        { 'vladimir-popov/lualine-ex',           dev = true },
        { 'vladimir-popov/lualine-lsp-progress', branch = 'patch-1' },
        'nvim-lua/plenary.nvim',
    },
    opts = function()
        vim.api.nvim_set_hl(0, 'StatusLine', {})

        return {
            options = {
                always_divide_middle = true,
                globalstatus = true,
                component_separators = {
                    left = '%#lualine_a_normal#|',
                    right = '%#lualine_a_normal#|',
                },
                section_separators = { left = ' ', right = '' },
                theme = cosmos_dark,
            },
            sections = {
                lualine_a = {
                    {
                        'ex.progress',
                        top = false,
                        bottom = false,
                        mode = 'bar',
                        padding = 0,
                        separator = '',
                    },
                    { 'ex.cwd', padding = 0 },
                },
                lualine_b = {
                    {
                        'ex.relative_filename',
                        padding = 0,
                        external_prefix = '/…',
                        filename_only_prefix = '…/',
                        separator = '',
                        shorten = { length = 2, exclude = { 1 } },
                    },
                    icon_only({
                        icon = { '', color = { fg = 'orange' } },
                        cond = function()
                            return not vim.bo.modifiable
                        end,
                    }),
                    icon_only({
                        icon = { ' ', color = { fg = '#d76380' } },
                        cond = function()
                            return vim.bo.modified
                        end,
                    }),
                    icon_only({
                        icon = { '', color = { fg = colors.command } },
                        cond = function()
                            return vim.bo.readonly
                        end,
                    }),
                },
                lualine_c = {
                    'lsp_progress',
                    -- lsp_status
                },
                lualine_x = {
                    {
                        'ex.git.branch',
                        max_length = 0.2,
                    },
                },
                lualine_y = {
                    'diagnostics',
                    {
                        'ex.lsp.all',
                        icons_only = true,
                        icons = {
                            lsp_is_off = '󰚦',
                            buf_ls = { '󰰚' },
                            ['null-ls'] = '',
                        },
                        separator = '',
                    },
                    icon_only({
                        icon = { '', color = { fg = 'red' } },
                        cond = function()
                            local ok, dap = pcall(require, 'dap')
                            return ok and dap.session() ~= nil
                        end,
                    }),
                    -- {
                    --     'ex.lsp.null_ls',
                    --     padding = 0,
                    --     icon = { '', color = { fg = 'green' } },
                    -- },
                    icon_only({
                        icon = { '󱙃', color = { fg = '#d76380' } },
                        cond = function()
                            local status, plugin = pcall(require, 'auto-save')
                            return not (status and plugin.get_autosave_state())
                        end,
                    }),
                    { 'filetype',   icons_enabled = false },
                    { 'ex.location' },
                },
                lualine_z = {
                    { 'ex.progress', top = false, bottom = false, mode = 'bar', padding = 0 },
                },
            },
            inactive_sections = {
                lualine_a = { 'mode' },
                lualine_b = { 'filename' },
            },
            -- winbar = {
            -- 	lualine_a = {
            -- 		"filename",
            -- 	},
            -- 	lualine_y = {
            -- 		{ "ex.spellcheck", icon = "󰓆", on_click = toggle_spell },
            -- 		"location",
            -- 	},
            -- },
            -- inactive_winbar = {
            -- 	lualine_c = {
            -- 		"filename",
            -- 	},
            -- },
        }
    end
}
