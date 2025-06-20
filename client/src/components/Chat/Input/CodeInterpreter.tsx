import debounce from 'lodash/debounce';
import React, { memo, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { TerminalSquareIcon, Laptop } from 'lucide-react';
import {
  Tools,
  AuthType,
  Constants,
  LocalStorageKeys,
  PermissionTypes,
  Permissions,
} from 'librechat-data-provider';
import ApiKeyDialog from '~/components/SidePanel/Agents/Code/ApiKeyDialog';
import { useLocalize, useHasAccess, useCodeApiKeyForm } from '~/hooks';
import CheckboxButton from '~/components/ui/CheckboxButton';
import useLocalStorage from '~/hooks/useLocalStorageAlt';
import { useVerifyAgentToolAuth } from '~/data-provider';
import { ephemeralAgentByConvoId } from '~/store';

const storageCondition = (value: unknown, rawCurrentValue?: string | null) => {
  if (rawCurrentValue) {
    try {
      const currentValue = rawCurrentValue?.trim() ?? '';
      if (currentValue === 'true' && value === false) {
        return true;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return value !== undefined && value !== null && value !== '' && value !== false;
};

function CodeInterpreter({ conversationId }: { conversationId?: string | null }) {
  const triggerRef = useRef<HTMLInputElement>(null);
  const localize = useLocalize();
  const key = conversationId ?? Constants.NEW_CONVO;

  const canRunCode = useHasAccess({
    permissionType: PermissionTypes.RUN_CODE,
    permission: Permissions.USE,
  });
  const [ephemeralAgent, setEphemeralAgent] = useRecoilState(ephemeralAgentByConvoId(key));
  const isCodeToggleEnabled = useMemo(() => {
    return ephemeralAgent?.execute_code ?? false;
  }, [ephemeralAgent?.execute_code]);

  const { data } = useVerifyAgentToolAuth(
    { toolId: Tools.execute_code },
    {
      retry: 1,
    },
  );
  const authType = useMemo(() => data?.message ?? false, [data?.message]);
  const isAuthenticated = useMemo(() => data?.authenticated ?? false, [data?.authenticated]);
// const { methods, onSubmit, isDialogOpen, setIsDialogOpen, handleRevokeApiKey } =
// useCodeApiKeyForm({});

  const setValue = useCallback(
    (isChecked: boolean) => {
      setEphemeralAgent((prev) => ({
        ...prev,
        execute_code: isChecked,
      }));
    },
    [setEphemeralAgent],
  );

  const [runCode, setRunCode] = useLocalStorage<boolean>(
    `${LocalStorageKeys.LAST_CODE_TOGGLE_}${key}`,
    isCodeToggleEnabled,
    setValue,
    storageCondition,
  );

  const handleChange = useCallback(
    (isChecked: boolean) => {
      setRunCode(isChecked);
    },
    [setRunCode],
  );

  const debouncedChange = useMemo(
    () => debounce(handleChange, 50, { leading: true }),
    [handleChange],
  );

  // Always use browser-based execution (Pyodide)
  useEffect(() => {
    // Set browser execution to always be true
    localStorage.setItem(LocalStorageKeys.BROWSER_CODE_EXECUTION, 'true');
  }, []);

  if (!canRunCode) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <CheckboxButton
          className="max-w-fit"
          defaultChecked={runCode}
          setValue={debouncedChange}
          label={localize('com_assistants_code_interpreter') + " (Browser Python)"}
          isCheckedClassName="border-purple-600/40 bg-purple-500/10 hover:bg-purple-700/10"
          icon={<TerminalSquareIcon className="icon-md" />}
        />
      </div>
    </>
  );
}

export default memo(CodeInterpreter);
