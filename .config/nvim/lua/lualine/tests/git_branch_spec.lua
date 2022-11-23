local uv = vim.loop
local ex_git = require('lualine.ex.git')

describe('GitsignsProvider', function()
    local P = ex_git.provider['nvim-tree']

    -- Tmp directory to test
    local git_root

    before_each(function()
        git_root = vim.fs.normalize('$TMPDIR/__git-root__')
        local result, err_msg = uv.fs_mkdtemp(git_root)
        assert(result, err_msg)
        git_root = result
        vim.cmd('cd ' .. git_root)
        os.execute('git init')
    end)

    after_each(function()
        os.execute('rm -rf ' .. git_root)
    end)

    describe('when cwd is git root', function()
        local p = P:new(git_root)

        it('is_git_workspace should return true', function()
            assert.True(p:is_git_workspace())
        end)

        -- it('git_brnach() should return the name of the current git branch', function()
        --     assert.are.equal('master', p:git_branch())
        -- end)
    end)
end)
