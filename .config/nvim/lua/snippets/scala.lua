local forc = s(
    'forc',
    fmta(
        [[for {
  _ <<- <>
} yield ???]],
        { i(1) }
    )
)

local cats = s('cats', t('import cats.implicits._'))

local scalatest_freespec = s(
    'scalatest',
    fmta(
        [[import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class <>Test extends AnyFreeSpec with Matchers {
    <>
}
]],
        {
            f(function()
                local name = string.gsub(vim.fn.expand('%:t'), '(%w+).test.scala', '%1')
                return name
            end),
            i(0),
        }
    )
)

local snippets = {
    cats,
    scalatest_freespec,
}
local autosnippets = {
    forc,
}

return snippets, autosnippets
