$files = Get-ChildItem "d:\29GB Material\Shiv\www.forherpilates.com.au\*.html"

$loginButtonHtml = @'
                <div class="header-actions-action header-actions-action--cta" data-animation-role="header-element">
                  <a
                    class="btn btn--border theme-btn--primary-inverse sqs-button-element--primary"
                    href="admin-login.html"
                    style="margin-right: 10px;"
                  >
                    Login
                  </a>
                </div>

'@

$loginDone = @()

foreach ($file in $files) {
    if ($file.Name -eq "admin-login.html" -or $file.Name -eq "admin-dashboard.html") {
        continue
    }
    
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # Look for the JOIN NOW button pattern
    if ($content -match 'href="pricing\.html".*?JOIN NOW') {
        # Check if Login button already exists
        if ($content -notmatch 'href="admin-login\.html"') {
            # Replace the pattern to add Login button before JOIN NOW
            $newContent = $content -replace '(href="pricing\.html"[^>]*>[^<]*<[^>]*>[\r\n\s]*JOIN NOW)', ($loginButtonHtml + '$1')
            
            Set-Content $file.FullName -Value $newContent -Encoding UTF8
            $loginDone += $file.Name
            Write-Host "✓ Added Login button to $($file.Name)"
        } else {
            Write-Host "- Login button already exists in $($file.Name)"
        }
    } else {
        Write-Host "? Could not find JOIN NOW button pattern in $($file.Name)"
    }
}

Write-Host "`nLogin button added to: $($loginDone.Count) files"
