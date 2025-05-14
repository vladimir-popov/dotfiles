return {
    'hrsh7th/nvim-cmp',
    event = 'InsertEnter',
    -- enabled = false,
    dependencies = {
        'hrsh7th/cmp-buffer',
        'hrsh7th/cmp-path',
        'hrsh7th/cmp-nvim-lsp',
        'hrsh7th/cmp-nvim-lsp-signature-help',
        'saadparwaiz1/cmp_luasnip',
        { 'windwp/nvim-autopairs', opts = { check_ts = true } },
    },
    config = function()
        -- Colorify different types of suggestions like in VsCode:
        -- gray
        vim.api.nvim_set_hl(
            0,
            'CmpItemAbbrDeprecated',
            { bg = 'NONE', strikethrough = true, fg = '#808080' }
        )
        -- blue
        vim.api.nvim_set_hl(0, 'CmpItemAbbrMatch', { bg = 'NONE', fg = '#569CD6' })
        vim.api.nvim_set_hl(0, 'CmpItemAbbrMatchFuzzy', { link = 'CmpIntemAbbrMatch' })
        -- light blue
        vim.api.nvim_set_hl(0, 'CmpItemKindVariable', { bg = 'NONE', fg = '#9CDCFE' })
        vim.api.nvim_set_hl(0, 'CmpItemKindInterface', { link = 'CmpItemKindVariable' })
        vim.api.nvim_set_hl(0, 'CmpItemKindText', { link = 'CmpItemKindVariable' })
        -- pink
        vim.api.nvim_set_hl(0, 'CmpItemKindFunction', { bg = 'NONE', fg = '#C586C0' })
        vim.api.nvim_set_hl(0, 'CmpItemKindMethod', { link = 'CmpItemKindFunction' })
        -- front
        vim.api.nvim_set_hl(0, 'CmpItemKindKeyword', { bg = 'NONE', fg = '#D4D4D4' })
        vim.api.nvim_set_hl(0, 'CmpItemKindProperty', { link = 'CmpItemKindKeyword' })
        vim.api.nvim_set_hl(0, 'CmpItemKindUnit', { link = 'CmpItemKindKeyword' })

        local kind_icons = {
            Text = '',
            Method = '󰆧',
            Function = '󰊕',
            Constructor = '',
            Field = '󰇽',
            Variable = '󰂡',
            Class = '󰠱',
            Interface = '',
            Module = '',
            Property = '󰜢',
            Unit = '',
            Value = '󰎠',
            Enum = '',
            Keyword = '󰌋',
            Snippet = '',
            Color = '󰏘',
            File = '󰈙',
            Reference = '',
            Folder = '󰉋',
            EnumMember = '',
            Constant = '󰏿',
            Struct = '',
            Event = '',
            Operator = '󰆕',
            TypeParameter = '󰅲',
        }

        local cmp = require('cmp')
        local compare = require('cmp.config.compare')
        local types = require('cmp.types')

        local has_words_before = function()
            local line, col = unpack(vim.api.nvim_win_get_cursor(0))
            return col ~= 0
                and vim.api
                .nvim_buf_get_lines(0, line - 1, line, true)[1]
                :sub(col, col)
                :match('%s')
                == nil
        end

        local default_sources = {
            { name = 'nvim_lsp_signature_help', group_index = 1 },
            { name = 'luasnip',                 group_index = 2 },
            { name = 'nvim_lsp',                group_index = 3 },
            { name = 'buffer',                  group_index = 4 },
            { name = 'path',                    group_index = 5 },
        }
        -- See defaults here https://github.com/hrsh7th/nvim-cmp/blob/main/lua/cmp/config/default.lua
        cmp.setup({
            snippet = {
                expand = function(args)
                    require('luasnip').lsp_expand(args.body)
                end,
            },
            mapping = {
                ['<C-d>'] = cmp.mapping.scroll_docs(-4),
                ['<C-f>'] = cmp.mapping.scroll_docs(4),
                ['<C-e>'] = cmp.mapping.abort(),
                ['<CR>'] = cmp.mapping.confirm(),
                ['<Down>'] = cmp.mapping(
                    cmp.mapping.select_next_item({ behavior = cmp.SelectBehavior.Select }),
                    { 'i' }
                ),
                ['<Up>'] = cmp.mapping(
                    cmp.mapping.select_prev_item({ behavior = cmp.SelectBehavior.Select }),
                    { 'i' }
                ),
                ['<Tab>'] = cmp.mapping(function(fallback)
                    if cmp.visible() then
                        cmp.select_next_item()
                    elseif has_words_before() then
                        cmp.complete()
                    else
                        fallback()
                    end
                end, { 'i', 's' }),
                ['<S-Tab>'] = cmp.mapping(function(fallback)
                    if cmp.visible() then
                        cmp.select_prev_item()
                    else
                        fallback()
                    end
                end, { 'i', 's' }),
            },
            preselect = types.cmp.PreselectMode.None,
            sources = cmp.config.sources(default_sources),
            -- see https://github.com/hrsh7th/nvim-cmp/blob/a110e12d0b58eefcf5b771f533fc2cf3050680ac/lua/cmp/matcher_spec.lua#L39
            matching = {
                -- assert.is.truthy(matcher.match('fmodify', 'fnamemodify', { disallow_fuzzy_matching = true }) == 0)
                -- assert.is.truthy(matcher.match('fmodify', 'fnamemodify', { disallow_fuzzy_matching = false }) >= 1)
                -- default is false
                disallow_fuzzy_matching = false,
                -- assert.is.truthy(matcher.match('Unit', 'net.UnixListener', { disallow_partial_fuzzy_matching = true }, config.matching) == 0)
                -- assert.is.truthy(matcher.match('Unit', 'net.UnixListener', { disallow_partial_fuzzy_matching = false }, config.matching) >= 1)
                -- default is true
                disallow_partial_fuzzy_matching = true,
                -- assert.is.truthy(matcher.match('fb', 'foo_bar', { disallow_partial_matching = true }) == 0)
                -- assert.is.truthy(matcher.match('fb', 'foo_bar', { disallow_partial_matching = false }) >= 1)
                -- assert.is.truthy(matcher.match('fb', 'fboo_bar', { disallow_partial_matching = true }) >= 1)
                -- assert.is.truthy(matcher.match('fb', 'fboo_bar', { disallow_partial_matching = false }) >= 1)
                -- default is false
                disallow_partial_matching = false,
                -- assert.is.truthy(matcher.match('bar', 'foo_bar', { disallow_prefix_unmatching = true }) == 0)
                -- assert.is.truthy(matcher.match('bar', 'foo_bar', { disallow_prefix_unmatching = false }) >= 1)
                -- default is false
                disallow_prefix_unmatching = false
            },
            sorting = {
                priority_weight = 2,
                comparators = {
                    compare.offset,
                    compare.exact,
                    compare.score,
                    compare.locality,
                    compare.kind,
                    compare.length,
                    compare.order,
                    compare.recently_used,
                },
            },
            formatting = {
                format = function(entry, vim_item)
                    -- fancy icons + text
                    vim_item.kind = string.format('%s %s', kind_icons[vim_item.kind], vim_item.kind)

                    -- cut the looooong text
                    local MAX_LENGTH = 80
                    if string.len(vim_item.abbr) > MAX_LENGTH then
                        vim_item.abbr = string.sub(vim_item.abbr, 1, MAX_LENGTH) .. '...'
                    end

                    -- set a name for each source
                    vim_item.menu = ({
                        buffer = '[Buffer]',
                        nvim_lsp = '[LSP]',
                        luasnip = '[LuaSnip]',
                        nvim_lua = '[Nvim]',
                        latex_symbols = '[Latex]',
                    })[entry.source.name]
                    return vim_item
                end,
            },
        })

        -- Set configuration for specific filetype.
        cmp.setup.filetype('lua', {
            sources = cmp.config.sources(
                vim.tbl_extend('keep', default_sources, { { name = 'nvim_lua' } })
            ),
        })

        -- -- Use buffer source for `/` and `?`
        -- cmp.setup.cmdline({ "/", "?" }, {
        -- 	mapping = cmp.mapping.preset.cmdline(),
        -- 	sources = {
        -- 		{ name = "buffer" },
        -- 	},
        -- })

        -- Use cmdline & path source for ':'
        -- cmp.setup.cmdline(':', {
        --     mapping = cmp.mapping.preset.cmdline(),
        --     sources = cmp.config.sources({
        --         { name = 'path' },
        --     }, {
        --         { name = 'cmdline' },
        --     }),
        -- })

        -- Mapping <CR> for autopairs
        local cmp_autopairs = require('nvim-autopairs.completion.cmp')
        cmp.event:on('confirm_done', cmp_autopairs.on_confirm_done())
    end,
}
