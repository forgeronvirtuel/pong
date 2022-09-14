import React from "react";
import {Routes, Route, Link } from "react-router-dom";
import User from "../NavBar/Pages-To-Change/User";
import "./Profile.css";
import UserPicture from "./User Picture/UserPicture";

export function ProfileName () {
	return (
		<div className="flex flex-row gap-8 self-center">
			<UserPicture width="150px" />
			<div className="self-center">
				<Link to="/profile">
					<h1 className="text-xl font-mono font-bold">Profile</h1>
				</Link>
			</div>
		</div>
	)
}


function MatchHistory () {
	return (
		<div className="grid grid-cols-3 place-content-around place-items-center">
			<div>Date</div>
			<div>Score</div>
			<div>Opponent</div>
			<div>10/09 13:50</div>
			<div>10-2</div>
			<div>nickname</div>
			<div>7</div>
			<div>8</div>
			<div>9</div>
			<div>1</div>
			<div>2</div>
			<div>3</div>
			<div>4</div>
			<div>5</div>
			<div>6</div>
			<div>7</div>
			<div>8</div>
			<div>9</div>
		</div>
	)
}

function Profile () {
	let star = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Empty_Star.svg/800px-Empty_Star.svg.png';
	return (
		<div className="bg-black text-white h-screen flex grid grid-cols-10 grid-rows-6 gap-8">
			<div className="col-start-2 col-span-3 row-start-2">
				<ProfileName />
			</div>
			<div className="row-start-2 row-span-3 col-start-6 col-span-3">
				<MatchHistory />
			</div>
			<div className="row-start-3 flex flex-row col-start-2 col-span-3 max-h-[22rem]">
				<div className="self-center">
					<Link to="/leaderboard"> 
						<img
							src={star}
							alt="LeaderBoard"
							width={'40px'}
						/>
					</Link>
				</div>
				<div className="self-center">
					<Link to="/leaderboard">
						<h1 className="text-l font-mono font-semibold">1st !</h1>
					</Link>
				</div>
			</div>
			<div className="col-span-10"/>
			<div className="col-span-10"/>
		</div>
		)
}

export default Profile