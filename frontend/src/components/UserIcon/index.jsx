import React, { memo } from "react";
import usePfp from "../../hooks/usePfp";
import UserDefaultPfp from "./user.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faOtter } from "@fortawesome/free-solid-svg-icons";

const UserIcon = memo(({ role }) => {
  const { pfp } = usePfp();

  return (
    <div className="relative w-[35px] h-[35px] rounded-full flex-shrink-0 overflow-hidden">
      {role === "user" && <RenderUserPfp pfp={pfp} />}
      {role !== "user" && (
        <div className="flex items-center justify-center rounded-full border-solid border border-white/40 light:border-theme-sidebar-border light:bg-theme-bg-chat-input w-full h-full">
          <FontAwesomeIcon 
            icon={faOtter} 
            className="text-theme-text-primary"
            style={{ fontSize: '20px' }}
          />
        </div>
      )}
    </div>
  );
});

function RenderUserPfp({ pfp }) {
  if (!pfp)
    return (
      <img
        src={UserDefaultPfp}
        alt="User profile picture"
        className="rounded-full border-none"
      />
    );

  return (
    <img
      src={pfp}
      alt="User profile picture"
      className="absolute top-0 left-0 w-full h-full object-cover rounded-full border-none"
    />
  );
}

export default UserIcon;
