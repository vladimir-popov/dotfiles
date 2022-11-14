describe('GitsignsProvider', function()
    local P = require('lualine.ex.git').provider.GitsignsProvider

    it('should be sucessfully initialized if vim.b.gitsigns_status_dict is defined', function()
        vim.b.gitsigns_status_dict = {}
        P:new()
    end)

    describe('git_branch', function()
        it('should return the vim.b.gitsigns_status_dict.head as the git branch', function()
            local p = P:new()
            vim.b.gitsigns_status_dict = { head = 'test' }
            assert.are.equal('test', p:git_branch())
        end)
    end)

    it('should return the new dict with values from the vim.b.gitsigns_status_dict', function()
        local p = P:new()
        vim.b.gitsigns_status_dict = { head = 'test', added = 1, changed = 2, removed = 3 }
        assert.are.same({ added = 1, changed = 2, removed = 3 }, p:git_changes())
    end)

    it('should return true when at least one change exists', function()
        local p = P:new()
        vim.b.gitsigns_status_dict = { added = 1 }
        assert.True(p:is_file_changed())

        vim.b.gitsigns_status_dict = { changed = 1 }
        assert.True(p:is_file_changed())

        vim.b.gitsigns_status_dict = { removed = 1 }
        assert.True(p:is_file_changed())
    end)

    describe('is_git_workspace', function()
        it(
            'should return true if the cwd is a subdir of the vim.b.gitsigns_status_dict.root',
            function()
                -- given:
                local p = P:new()
                local orig = vim.fn.getcwd
                vim.fn.getcwd = function()
                    return '/usr/git/src'
                end
                vim.b.gitsigns_status_dict = { root = '/usr/git' }

                -- when:
                local result = p:is_git_workspace()
                -- then:
                vim.fn.getcwd = orig
                assert.True(result)
            end
        )
    end)
end)
