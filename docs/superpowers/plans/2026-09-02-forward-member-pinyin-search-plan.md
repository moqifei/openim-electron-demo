# 消息转发企业成员拼音模糊搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复消息转发企业成员搜索使用的拼音匹配逻辑，使中文姓名、完整拼音、拼音首字母和部分拼音都能命中。

**Architecture:** 转发弹窗通过 `ChooseBox` 的企业成员搜索路径调用 `filterByFuzzyPinyin`。该路径已有“后端拼音查询无结果时拉取全量企业成员并本地过滤”的兜底，因此本次只恢复 `fuzzyPinyinMatch` 对 `toPinyin` 和 `getPinyinInitials` 的实际匹配，让现有转发路径生效；不改群组、AI/应用或部门选择流程。

**Tech Stack:** TypeScript, React, Playwright test runner, Vite build, `src/utils/pinyin.ts`。

## Global Constraints

- 仅增强消息转发弹窗中的企业成员姓名搜索。
- 不改变顶部搜索框的组件实现、群组搜索、AI/应用搜索、群内成员校验或后端接口协议。
- 复用现有 `toPinyin`、`getPinyinInitials` 和 `filterByFuzzyPinyin`，不新增依赖。
- 保留工作区中用户已有的未提交修改，不执行重置、清理或覆盖操作。
- 生产代码必须先有一个实际失败的测试，再进行实现。

---

### Task 1: Add a failing regression test for Chinese-name pinyin matching

**Files:**

- Create: `e2e/forwardMemberPinyinSearch.spec.ts`
- Reference: `src/utils/pinyin.ts`

**Interfaces:**

- Consumes: `filterByFuzzyPinyin<T>(items: T[], keyword: string): T[]`.
- Produces: A regression test that requires one Chinese member to be found by Chinese text, full pinyin, pinyin initials, and partial pinyin.

- [ ] **Step 1: Write the failing test**

Create `e2e/forwardMemberPinyinSearch.spec.ts` with this test:

```ts
import { expect, test } from "@playwright/test";

import { filterByFuzzyPinyin } from "../src/utils/pinyin";

test("matches enterprise member names by Chinese text, full pinyin, initials, and partial pinyin", () => {
  const members = [
    { userID: "u-zhang-san", nickname: "张三" },
    { userID: "u-li-si", nickname: "李四" },
  ];

  for (const keyword of ["张三", "zhangsan", "zs", "zhang", "san"]) {
    expect(filterByFuzzyPinyin(members, keyword)).toEqual([members[0]]);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npx playwright test e2e/forwardMemberPinyinSearch.spec.ts
```

Expected result: FAIL for at least `zhangsan`, `zs`, `zhang`, or `san`, because the current `fuzzyPinyinMatch` only checks the lower-cased display name and a word-boundary expression; it does not check `toPinyin(name)` or `getPinyinInitials(name)`.

If the test fails because Playwright cannot start or compile the test, fix only the test command/setup issue and rerun until the assertion fails for the missing pinyin behavior.

### Task 2: Restore pinyin matching in the shared matcher

**Files:**

- Modify: `src/utils/pinyin.ts:480-501`
- Test: `e2e/forwardMemberPinyinSearch.spec.ts`

**Interfaces:**

- Consumes: Existing `toPinyin(name)` and `getPinyinInitials(name)` helpers.
- Produces: `fuzzyPinyinMatch(name, keyword): boolean` returning `true` for direct Chinese/ASCII substring, full-pinyin substring, initials substring, or the existing word-boundary case.

- [ ] **Step 1: Write the minimal implementation**

Inside `fuzzyPinyinMatch`, keep the existing normalization and direct-name matching, then add the two missing checks before the word-boundary fallback:

```ts
const fullPinyin = toPinyin(name);
if (fullPinyin.includes(trimKeyword)) {
  return true;
}

const initials = getPinyinInitials(name);
if (initials.includes(trimKeyword)) {
  return true;
}
```

The complete decision order remains:

```ts
const lowerName = name.toLowerCase();

if (lowerName.includes(trimKeyword)) {
  return true;
}

const fullPinyin = toPinyin(name);
if (fullPinyin.includes(trimKeyword)) {
  return true;
}

const initials = getPinyinInitials(name);
if (initials.includes(trimKeyword)) {
  return true;
}

const wordBoundaryRE = new RegExp(`(?:^|[-_./\\s])${escapeRegExp(trimKeyword)}`, "i");
return wordBoundaryRE.test(name);
```

Do not alter `fuzzyPinyinMatchDesc`, the member scoring order, the pinyin dictionary, or any component outside this matcher.

- [ ] **Step 2: Run the focused test to verify it passes**

Run:

```powershell
npx playwright test e2e/forwardMemberPinyinSearch.spec.ts
```

Expected result: PASS, with all five keywords returning only the “张三” member.

### Task 3: Verify the existing transfer fallback and project integrity

**Files:**

- Verify only: `src/pages/common/ChooseModal/ChooseBox/index.tsx`
- Test: `e2e/forwardMemberPinyinSearch.spec.ts`

**Interfaces:**

- Consumes: Existing `ChooseBox` enterprise-member search path and its `filterByFuzzyPinyin` call.
- Produces: Evidence that the transfer search still performs local filtering after an empty backend pinyin search fallback.

- [ ] **Step 1: Verify the transfer path statically**

Run:

```powershell
rg -n "searchADMembers|filterByFuzzyPinyin|keyword: \"\"|setCheckList" src/pages/common/ChooseModal/ChooseBox/index.tsx
```

Expected result: the file contains all of the following in the enterprise-member search branch:

- the keyword search request;
- `filterByFuzzyPinyin(members, trimmed)`;
- the empty-keyword fallback request;
- a second `filterByFuzzyPinyin` call on the fallback member list;
- `setCheckList` with the checked filtered result.

No code change is expected in this step because that fallback already exists in the current source.

- [ ] **Step 2: Run the focused test and source checks together**

Run:

```powershell
npx playwright test e2e/forwardMemberPinyinSearch.spec.ts
git diff --check
```

Expected result: the Playwright test passes and `git diff --check` produces no output.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected result: Vite completes successfully without TypeScript or bundling errors. If the build reports errors in files already modified before this task, record them separately and do not alter unrelated files.

- [ ] **Step 4: Review the final diff**

Run:

```powershell
git diff -- src/utils/pinyin.ts e2e/forwardMemberPinyinSearch.spec.ts
git status --short
```

Expected result: the task diff contains only the pinyin matcher change and the focused regression test; all pre-existing user changes remain present and untouched.
