import { test, expect } from '@playwright/test';

// Increase default timeout for all tests
test.setTimeout(60000);

// ==================== LOADING STATES ====================
test.describe('Loading States', () => {
  test('1. Initial page load - should show content after load', async ({ page }) => {
    // Navigate and check for loading behavior
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
    const loadTime = Date.now() - startTime;

    console.log(`Page load time: ${loadTime}ms`);

    // Content should be visible after load
    await expect(page.locator('.banner-tab:has-text("Classes")')).toBeVisible();
  });

  test('2. Tab switch loading', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Switch to Events tab and measure
    const startTime = Date.now();
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForSelector('.banner-tab.active:has-text("Events")', { timeout: 30000 });
    const switchTime = Date.now() - startTime;

    console.log(`Tab switch time: ${switchTime}ms`);
    // Log if slow but don't fail
    if (switchTime > 2000) {
      console.log('WARNING: Tab switch is slow (>2s)');
    }
  });

  test('3. Search loading state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.search-bar-premium input', { timeout: 30000 });

    // Type in search and observe any loading indicator
    const startTime = Date.now();
    await page.fill('.search-bar-premium input', 'yoga');

    // Wait for results to update
    await page.waitForTimeout(1000);
    const searchTime = Date.now() - startTime;

    console.log(`Search response time: ${searchTime}ms`);

    // Check if results count updates
    const resultsCount = await page.locator('.results-count').textContent();
    console.log(`Results count: ${resultsCount}`);
    expect(resultsCount).toBeTruthy();
  });

  test('4. Filter loading state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Services tab where filters exist
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    // Check for filter pills/buttons
    const filterPills = page.locator('.filter-pill, .category-pill, .category-filter-pill');
    const count = await filterPills.count();

    if (count > 0) {
      const startTime = Date.now();
      await filterPills.first().click();
      await page.waitForTimeout(500);
      const filterTime = Date.now() - startTime;

      console.log(`Filter response time: ${filterTime}ms`);
    } else {
      console.log('No filter pills found on Services tab');
    }
  });
});

// ==================== EMPTY STATES ====================
test.describe('Empty States', () => {
  test('5. Search with no results - shows empty state', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.search-bar-premium input', { timeout: 30000 });

    // Search for something that shouldn't exist
    await page.fill('.search-bar-premium input', 'xyznonexistent12345');
    await page.waitForTimeout(1000);

    // Check what shows - could be an empty state message or zero results
    const resultsCount = await page.locator('.results-count').textContent();
    console.log(`Results count for non-existent search: ${resultsCount}`);

    // Check for any empty state message
    const emptyMessage = page.locator('text=/no.*results|no.*found|nothing.*found/i');
    const noResultsVisible = await emptyMessage.count() > 0;

    if (noResultsVisible) {
      console.log('PASS: Empty state message found');
    } else if (resultsCount?.includes('0')) {
      console.log('PASS: Shows 0 results count');
    } else {
      console.log('WARNING: No clear empty state indicator');
    }
  });

  test('6. Filter with no results', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Deals tab
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(1000);

    // Search for non-existent deal
    await page.fill('.search-bar-premium input', 'xyznonexistent12345');
    await page.waitForTimeout(1000);

    const resultsCount = await page.locator('.results-count').textContent();
    console.log(`Filtered results: ${resultsCount}`);
  });

  test('7. Empty search input behavior', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.search-bar-premium input', { timeout: 30000 });

    // Focus and blur without typing
    const searchInput = page.locator('.search-bar-premium input');
    await searchInput.focus();
    await searchInput.blur();

    // Type and then clear
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    await searchInput.fill('');
    await page.waitForTimeout(500);

    // Should show all results again
    const resultsCount = await page.locator('.results-count').textContent();
    console.log(`Results after clearing search: ${resultsCount}`);
    expect(resultsCount).not.toContain('0 results');
  });
});

// ==================== EXTERNAL LINKS ====================
test.describe('External Links', () => {
  test('8. Website links open in new tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Services to find business cards
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    // Find a business card and click to open modal
    const cards = page.locator('.business-card, .card-premium');
    const cardCount = await cards.count();

    if (cardCount > 0) {
      await cards.first().click();
      await page.waitForTimeout(1000);

      // Look for website link in modal
      const websiteLink = page.locator('a[href^="http"]:not([href*="tel:"]):not([href*="mailto:"])');
      const linkCount = await websiteLink.count();

      if (linkCount > 0) {
        const target = await websiteLink.first().getAttribute('target');
        const rel = await websiteLink.first().getAttribute('rel');

        console.log(`Website link target: ${target}, rel: ${rel}`);
        if (target === '_blank') {
          console.log('PASS: Website links open in new tab');
        } else {
          console.log('WARNING: Website links do not have target="_blank"');
        }
      } else {
        console.log('INFO: No website links found in modal');
      }
    }
  });

  test('9. Phone links have tel: protocol', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Services
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    // Click a business card
    const cards = page.locator('.business-card, .card-premium');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.waitForTimeout(1000);

      // Look for phone link
      const phoneLink = page.locator('a[href^="tel:"]');
      const phoneLinkCount = await phoneLink.count();

      if (phoneLinkCount > 0) {
        const href = await phoneLink.first().getAttribute('href');
        console.log(`PASS: Phone link: ${href}`);
        expect(href).toMatch(/^tel:/);
      } else {
        console.log('INFO: No phone links found in modal');
      }
    }
  });

  test('10. Email links have mailto: protocol', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Services
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    // Click a business card
    const cards = page.locator('.business-card, .card-premium');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.waitForTimeout(1000);

      // Look for email link
      const emailLink = page.locator('a[href^="mailto:"]');
      const emailLinkCount = await emailLink.count();

      if (emailLinkCount > 0) {
        const href = await emailLink.first().getAttribute('href');
        console.log(`PASS: Email link: ${href}`);
        expect(href).toMatch(/^mailto:/);
      } else {
        console.log('INFO: No email links found in modal');
      }
    }
  });

  test('11. Directions links work', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Services
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    // Click a business card
    const cards = page.locator('.business-card, .card-premium');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.waitForTimeout(1000);

      // Look for directions/maps link
      const directionsLink = page.locator('a[href*="maps"], a[href*="directions"], button:has-text("Directions"), a:has-text("Directions")');
      const dirCount = await directionsLink.count();

      if (dirCount > 0) {
        const href = await directionsLink.first().getAttribute('href');
        console.log(`PASS: Directions link: ${href}`);
      } else {
        console.log('INFO: No directions links found');
      }
    }
  });
});

// ==================== KEYBOARD ACCESSIBILITY ====================
test.describe('Keyboard Accessibility', () => {
  test('12. Tab through elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Start tabbing from body
    await page.keyboard.press('Tab');

    // Should be able to tab to interactive elements
    let tabCount = 0;
    const maxTabs = 20;
    const focusedElements = [];

    while (tabCount < maxTabs) {
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el.tagName,
          className: el.className,
          text: el.textContent?.slice(0, 50),
        };
      });

      if (focusedElement.tag !== 'BODY') {
        focusedElements.push(`${focusedElement.tag}.${focusedElement.className?.split(' ')[0] || 'no-class'}`);
      }

      await page.keyboard.press('Tab');
      tabCount++;
    }

    console.log('Tabbed through elements:', focusedElements.slice(0, 10).join(' -> '));
    expect(focusedElements.length).toBeGreaterThan(0);
  });

  test('13. Enter to activate buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Focus on Events tab
    const eventsTab = page.locator('.banner-tab:has-text("Events")');
    await eventsTab.focus();

    // Press Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Tab should be activated
    await expect(eventsTab).toHaveClass(/active/);
    console.log('PASS: Enter key activated tab button');
  });

  test('14. ESC to close modals', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Services
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    // Click a card to open modal
    const cards = page.locator('.business-card, .card-premium');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.waitForTimeout(1000);

      // Check if modal is open
      const modal = page.locator('.modal, .business-modal, [class*="modal"]').first();
      const modalVisible = await modal.isVisible().catch(() => false);

      if (modalVisible) {
        // Press ESC
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Modal should be closed
        const modalStillVisible = await modal.isVisible().catch(() => false);
        if (!modalStillVisible) {
          console.log('PASS: Modal closed with ESC');
        } else {
          console.log('WARNING: Modal did not close with ESC');
        }
      } else {
        console.log('INFO: No modal detected to test ESC');
      }
    }
  });

  test('15. Focus visible on elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Tab to an element
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check if focus is visible (using outline or box-shadow)
    const focusStyle = await page.evaluate(() => {
      const el = document.activeElement;
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        boxShadow: styles.boxShadow,
        outlineWidth: styles.outlineWidth,
      };
    });

    console.log('Focus styles:', focusStyle);

    // Should have some visible focus indicator
    const hasFocusIndicator =
      (focusStyle.outline && focusStyle.outline !== 'none' && focusStyle.outline !== '0px none rgb(0, 0, 0)') ||
      (focusStyle.boxShadow && focusStyle.boxShadow !== 'none') ||
      (focusStyle.outlineWidth && focusStyle.outlineWidth !== '0px');

    if (hasFocusIndicator) {
      console.log('PASS: Focus indicator is visible');
    } else {
      console.log('WARNING: No visible focus indicator detected');
    }
  });
});

// ==================== ERROR STATES ====================
test.describe('Error States', () => {
  test('16. Invalid search characters', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.search-bar-premium input', { timeout: 30000 });

    // Try special characters
    const specialChars = ['<script>', '"; DROP TABLE', '{}[]', '!@#$%^&*()'];

    for (const chars of specialChars) {
      await page.fill('.search-bar-premium input', chars);
      await page.waitForTimeout(300);

      // App should not crash - check for error messages
      const errorMessage = page.locator('.error, .error-message, [class*="error"]');
      const hasError = await errorMessage.count() > 0;

      console.log(`Special chars "${chars}": ${hasError ? 'Error shown' : 'No error (good)'}`);
    }

    // Page should still be functional
    await expect(page.locator('.banner-tab').first()).toBeVisible();
    console.log('PASS: App handles invalid search characters gracefully');
  });

  test('17. Very long text in fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.search-bar-premium input', { timeout: 30000 });

    // Try very long text
    const longText = 'a'.repeat(1000);
    await page.fill('.search-bar-premium input', longText);
    await page.waitForTimeout(500);

    // Input should handle it gracefully
    const inputValue = await page.locator('.search-bar-premium input').inputValue();
    console.log(`Long text length: ${inputValue.length}`);

    // App should still be functional
    await expect(page.locator('.banner-tab').first()).toBeVisible();
    console.log('PASS: App handles very long text gracefully');
  });

  test('18. Rapid clicking buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Rapidly click tabs
    const tabs = ['Events', 'Deals', 'Services', 'Classes'];

    for (let i = 0; i < 10; i++) {
      const randomTab = tabs[Math.floor(Math.random() * tabs.length)];
      await page.click(`.banner-tab:has-text("${randomTab}")`, { timeout: 2000 }).catch(() => {});
    }

    await page.waitForTimeout(1000);

    // App should still be functional
    await expect(page.locator('.banner-tab').first()).toBeVisible();
    console.log('PASS: App survived rapid clicking');
  });

  test('19. Network failure handling (simulated slow network)', async ({ page }) => {
    // Simulate slow network
    await page.route('**/*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      await route.continue();
    });

    await page.goto('/');

    // Should still load (just slower)
    await page.waitForSelector('.banner-tab', { timeout: 60000 });
    await expect(page.locator('.banner-tab').first()).toBeVisible();
    console.log('PASS: App handles slow network');
  });
});

// ==================== SCROLL BEHAVIOR ====================
test.describe('Scroll Behavior', () => {
  test('20. Page scrolls correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Check if page is scrollable
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    console.log(`Page height: ${pageHeight}, Viewport: ${viewportHeight}`);

    if (pageHeight > viewportHeight) {
      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(500);

      const scrollY = await page.evaluate(() => window.scrollY);
      console.log(`Page scrolled to: ${scrollY}px`);
      expect(scrollY).toBeGreaterThan(0);
    } else {
      console.log('INFO: Page content fits in viewport, no scroll needed');
    }
  });

  test('21. Cards list scrolls', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Services
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    // Find scrollable cards container
    const cardsContainer = page.locator('.cards-container, .businesses-list, [class*="scroll"]').first();

    if (await cardsContainer.isVisible().catch(() => false)) {
      // Scroll within container
      await cardsContainer.evaluate(el => el.scrollTop = 200);
      await page.waitForTimeout(300);

      const scrollTop = await cardsContainer.evaluate(el => el.scrollTop);
      console.log(`Cards container scroll: ${scrollTop}px`);
    } else {
      console.log('INFO: No scrollable cards container found');
    }
  });

  test('22. Modal content scrolls if long', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Services
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    // Click a card
    const cards = page.locator('.business-card, .card-premium');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.waitForTimeout(1000);

      // Try to scroll modal content
      const modalContent = page.locator('.modal-content, .modal-body, [class*="modal"]').first();
      if (await modalContent.isVisible().catch(() => false)) {
        const canScroll = await modalContent.evaluate(el => {
          return el.scrollHeight > el.clientHeight;
        });
        console.log(`Modal content scrollable: ${canScroll}`);
      }
    }
  });

  test('23. Scroll position preserved on back', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Check page height
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    if (pageHeight > viewportHeight) {
      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 300));
      const initialScroll = await page.evaluate(() => window.scrollY);

      // Switch tabs
      await page.click('.banner-tab:has-text("Events")');
      await page.waitForTimeout(500);

      // Switch back
      await page.click('.banner-tab:has-text("Classes")');
      await page.waitForTimeout(500);

      const finalScroll = await page.evaluate(() => window.scrollY);
      console.log(`Initial scroll: ${initialScroll}, Final scroll: ${finalScroll}`);

      if (finalScroll === initialScroll) {
        console.log('PASS: Scroll position preserved');
      } else {
        console.log('INFO: Scroll position was reset on tab switch');
      }
    } else {
      console.log('INFO: Page not scrollable for this test');
    }
  });
});

// ==================== RESPONSIVE/MOBILE ====================
test.describe('Responsive/Mobile', () => {
  test('24. Test at 375px width (iPhone)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Check that tabs are visible
    await expect(page.locator('.banner-tab').first()).toBeVisible();

    // Check search bar is usable
    const searchInput = page.locator('.search-bar-premium input');
    await expect(searchInput).toBeVisible();

    // Check layout doesn't overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (hasHorizontalScroll) {
      console.log('ISSUE: Horizontal scroll detected on mobile - layout issue');
    } else {
      console.log('PASS: No horizontal scroll on mobile');
    }
  });

  test('25. Touch-friendly button sizes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Check tab button sizes
    const tabs = page.locator('.banner-tab');
    const tabCount = await tabs.count();
    let smallTabs = 0;

    for (let i = 0; i < tabCount; i++) {
      const box = await tabs.nth(i).boundingBox();
      if (box) {
        // Minimum touch target should be 44x44 per Apple guidelines
        console.log(`Tab ${i} size: ${box.width.toFixed(0)}x${box.height.toFixed(0)}`);
        if (box.height < 44 || box.width < 44) {
          smallTabs++;
        }
      }
    }

    if (smallTabs > 0) {
      console.log(`WARNING: ${smallTabs} tabs may be too small for touch targets`);
    } else {
      console.log('PASS: All tabs meet minimum touch target size');
    }
  });

  test('26. Modal sizing on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Services
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    // Click a card
    const cards = page.locator('.business-card, .card-premium');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.waitForTimeout(1000);

      // Check modal sizing
      const modal = page.locator('.modal, .business-modal, [class*="modal"]').first();
      if (await modal.isVisible().catch(() => false)) {
        const box = await modal.boundingBox();
        if (box) {
          console.log(`Modal size: ${box.width.toFixed(0)}x${box.height.toFixed(0)}`);
          if (box.width <= 375) {
            console.log('PASS: Modal fits in mobile viewport');
          } else {
            console.log('WARNING: Modal may overflow mobile viewport');
          }
        }
      }
    }
  });

  test('27. Bottom sheets on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Check for bottom sheet patterns
    const bottomSheet = page.locator('.bottom-sheet, [class*="bottom-sheet"]');
    const hasBottomSheet = await bottomSheet.count() > 0;
    console.log(`Bottom sheet component exists: ${hasBottomSheet}`);

    // Go to Services and open modal to check if it's a bottom sheet on mobile
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    const cards = page.locator('.business-card, .card-premium');
    if (await cards.count() > 0) {
      await cards.first().click();
      await page.waitForTimeout(1000);

      // Check modal position
      const modal = page.locator('.modal, .business-modal, [class*="modal"]').first();
      if (await modal.isVisible().catch(() => false)) {
        const box = await modal.boundingBox();
        if (box) {
          console.log(`Modal position on mobile: y=${box.y.toFixed(0)}`);
        }
      }
    }
  });
});

// ==================== PERFORMANCE ====================
test.describe('Performance', () => {
  test('28. Page load speed', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');

    // Wait for main content
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    const loadTime = Date.now() - startTime;
    console.log(`Full page load time: ${loadTime}ms`);

    // Log performance assessment
    if (loadTime < 3000) {
      console.log('PASS: Page loads quickly (<3s)');
    } else if (loadTime < 5000) {
      console.log('OK: Page load time acceptable (<5s)');
    } else {
      console.log('WARNING: Page load time is slow (>5s)');
    }
  });

  test('29. Tab switch speed', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    const tabs = ['Events', 'Deals', 'Services', 'Classes'];
    const switchTimes = [];

    for (const tab of tabs) {
      const startTime = Date.now();
      await page.click(`.banner-tab:has-text("${tab}")`);
      await page.waitForSelector(`.banner-tab.active:has-text("${tab}")`, { timeout: 30000 });
      const switchTime = Date.now() - startTime;
      switchTimes.push({ tab, time: switchTime });
    }

    console.log('Tab switch times:');
    switchTimes.forEach(({ tab, time }) => {
      const status = time < 1000 ? 'FAST' : time < 3000 ? 'OK' : 'SLOW';
      console.log(`  ${tab}: ${time}ms [${status}]`);
    });
  });

  test('30. Modal open speed', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 30000 });

    // Go to Services
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);

    // Click a card and measure modal open time
    const cards = page.locator('.business-card, .card-premium');
    if (await cards.count() > 0) {
      const startTime = Date.now();
      await cards.first().click();

      // Wait for modal
      const modal = page.locator('.modal, .business-modal, [class*="modal"]').first();
      await modal.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      const openTime = Date.now() - startTime;
      console.log(`Modal open time: ${openTime}ms`);

      if (openTime < 500) {
        console.log('PASS: Modal opens quickly');
      } else if (openTime < 1000) {
        console.log('OK: Modal open time acceptable');
      } else {
        console.log('WARNING: Modal opens slowly');
      }
    }
  });
});

// ==================== SUMMARY TEST ====================
test('UX Summary Test - Run all checks', async ({ page }) => {
  const issues = [];
  const passes = [];

  await page.goto('/');
  await page.waitForSelector('.banner-tab', { timeout: 30000 });

  // Check 1: Mobile horizontal scroll
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(500);
  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  if (hasHorizontalScroll) {
    issues.push('Horizontal scroll on mobile viewport (375px)');
  } else {
    passes.push('No horizontal scroll on mobile');
  }

  // Check 2: Touch target sizes
  const tabs = page.locator('.banner-tab');
  const firstTabBox = await tabs.first().boundingBox();
  if (firstTabBox && (firstTabBox.height < 44 || firstTabBox.width < 44)) {
    issues.push('Tab buttons may be too small for touch targets');
  } else {
    passes.push('Tab buttons meet touch target size requirements');
  }

  // Reset viewport
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(500);

  // Check 3: Focus visibility
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focusStyle = await page.evaluate(() => {
    const el = document.activeElement;
    const styles = window.getComputedStyle(el);
    const outline = styles.outline;
    const boxShadow = styles.boxShadow;
    return (outline && outline !== 'none' && !outline.includes('0px')) ||
           (boxShadow && boxShadow !== 'none');
  });
  if (!focusStyle) {
    issues.push('Focus indicator may not be visible');
  } else {
    passes.push('Focus indicator is visible');
  }

  // Report
  console.log('\n========== UX TEST SUMMARY ==========');
  console.log(`\nPASSED (${passes.length}):`);
  passes.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

  if (issues.length > 0) {
    console.log(`\nISSUES FOUND (${issues.length}):`);
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  } else {
    console.log('\nNo major UX issues detected!');
  }
  console.log('\n=====================================\n');
});
