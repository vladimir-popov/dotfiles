------------------------------------------------------------
-- Plugins
------------------------------------------------------------
vim.cmd([[packadd packer.nvim]])
require('packer').startup(function(use)
    -- packer can manage itself
    use({ 'wbthomason/packer.nvim', opt = true })
    -- colorschemes
    use('EdenEast/nightfox.nvim')
    use('Th3Whit3Wolf/one-nvim')
    -- icons with extended symbols
    use('kyazdani42/nvim-web-devicons')
    -- prettyfier a code
    use('sbdchd/neoformat')
    -- autocompletion
    use('hrsh7th/nvim-compe')
    use('onsails/lspkind-nvim')
    -- Install nvim-cmp, and buffer source as a dependency
    use({
        'hrsh7th/nvim-cmp',
        requires = {
            'hrsh7th/cmp-buffer',
            'hrsh7th/cmp-path',
            'hrsh7th/cmp-nvim-lsp',
            'onsails/lspkind-nvim',
        },
    })
    -- better quickfix
    use('kevinhwang91/nvim-bqf')
    -- file tree
    use('kyazdani42/nvim-tree.lua')
    -- nnn
    use({
        'mcchrish/nnn.vim',
        config = function()
            vim.g['nnn#session'] = 'local'
            require('utils').nmap('<c-n>', '<cmd>NnnPicker %:p:h<cr>')
        end,
    })
    -- side bar
    use('sidebar-nvim/sidebar.nvim')
    -- telescope
    use({
        'nvim-telescope/telescope.nvim',
        requires = { { 'nvim-lua/popup.nvim' }, { 'nvim-lua/plenary.nvim' } },
    })
    -- feline
    -- use 'famiu/feline.nvim'
    use({
        'famiu/feline.nvim',
        branch = 'develop',
        config = function()
            local nightfox = require('conf.feline-cosmos.themes').nightfox
            require('feline').setup({
                theme = nightfox,
                vi_mode_colors = nightfox.vi_mode_colors,
                components = require('conf.feline-cosmos').preset(),
            })
        end,
    })
    -- treesitter
    use({
        'nvim-treesitter/nvim-treesitter',
        run = ':TSUpdate',
    })
    use('nvim-treesitter/playground')
    use('nvim-treesitter/nvim-treesitter-textobjects')
    -- lsp
    use('neovim/nvim-lspconfig')
    use('tami5/lspsaga.nvim')
    -- dap
    use('mfussenegger/nvim-dap')
    -- scala lsp
    use('scalameta/nvim-metals')
    -- PlantUML
    use('aklt/plantuml-syntax')
    -- Colorize (:ColorizerAttachToBuffer)
    use('norcalli/nvim-colorizer.lua')
end)
